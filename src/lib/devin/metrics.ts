import type {
  AgentIssue,
  DailyActivity,
  DashboardData,
  DevinSession,
  PullRequestView,
  SessionStatus,
  SessionView,
} from "./types";

const STALLED_AFTER_MINUTES = 240;

function normalizeStatus(session: DevinSession): SessionStatus {
  const status = (session.status ?? "").toLowerCase();
  const detail = (session.status_detail ?? "").toLowerCase();
  if (status === "suspended" || status === "resuming") return "suspended";
  if (status === "error") return "expired";
  if (status === "exit") return "finished";
  if (status === "running") {
    if (detail === "waiting_for_user" || detail === "waiting_for_approval") return "blocked";
    if (detail === "finished") return "finished";
    return "working";
  }
  if (status === "new" || status === "claimed") return "working";
  return "unknown";
}

function rawStatus(session: DevinSession): string {
  return session.status_detail ? `${session.status}/${session.status_detail}` : session.status;
}

/** The v3 API returns Unix seconds; tolerate milliseconds too. */
function toIso(timestamp: number): string {
  const ms = timestamp < 1e12 ? timestamp * 1000 : timestamp;
  return new Date(ms).toISOString();
}

function minutesBetween(from: string, to: string): number {
  return Math.max(0, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 60_000));
}

function parsePullRequest(url: string): { repo: string; number: string } {
  const match = url.match(/github\.com\/([^/]+\/[^/]+)\/pull\/(\d+)/);
  if (match) return { repo: match[1], number: match[2] };
  return { repo: url.replace(/^https?:\/\//, "").split("/").slice(0, 2).join("/"), number: "" };
}

function toSessionView(session: DevinSession): SessionView {
  const createdAt = toIso(session.created_at);
  const updatedAt = toIso(session.updated_at);
  return {
    id: session.session_id,
    url:
      session.url || `https://app.devin.ai/sessions/${session.session_id.replace(/^devin-/, "")}`,
    title: session.title?.trim() || "Untitled session",
    status: normalizeStatus(session),
    rawStatus: rawStatus(session),
    createdAt,
    updatedAt,
    durationMinutes: minutesBetween(createdAt, updatedAt),
    requestedBy: session.user_id,
    tags: session.tags ?? [],
    pullRequestUrl: session.pull_requests?.[0]?.pr_url ?? null,
    acusConsumed: typeof session.acus_consumed === "number" ? session.acus_consumed : null,
  };
}

function detectIssues(sessions: SessionView[], now: number): AgentIssue[] {
  const issues: AgentIssue[] = [];

  for (const session of sessions) {
    const idleMinutes = Math.round((now - new Date(session.updatedAt).getTime()) / 60_000);
    const base = {
      sessionId: session.id,
      sessionUrl: session.url,
      sessionTitle: session.title,
      detectedAt: session.updatedAt,
    };

    if (session.status === "blocked") {
      issues.push({
        ...base,
        id: `${session.id}:blocked`,
        severity: "critical",
        kind: "blocked",
        summary: `Agent is blocked and waiting on input (idle ${formatMinutes(idleMinutes)})`,
      });
    } else if (session.status === "expired") {
      issues.push({
        ...base,
        id: `${session.id}:expired`,
        severity: "critical",
        kind: "expired",
        summary: "Session expired before reporting a result",
      });
    } else if (session.status === "working" && idleMinutes > STALLED_AFTER_MINUTES) {
      issues.push({
        ...base,
        id: `${session.id}:stalled`,
        severity: "warning",
        kind: "stalled",
        summary: `No progress for ${formatMinutes(idleMinutes)} while still marked working`,
      });
    } else if (session.status === "finished" && !session.pullRequestUrl) {
      issues.push({
        ...base,
        id: `${session.id}:no-output`,
        severity: "warning",
        kind: "no_output",
        summary: "Finished without opening a pull request",
      });
    }
  }

  return issues.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === "critical" ? -1 : 1;
    return new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime();
  });
}

export function formatAcus(value: number): string {
  return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m`;
  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
}

/** Start of the UTC day `windowDays - 1` days back, so buckets and cutoff agree. */
function windowStart(now: number, windowDays: number): number {
  const today = new Date(now);
  const todayStart = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate(),
  );
  return todayStart - (windowDays - 1) * 86_400_000;
}

function buildActivity(windowDays: number, now: number, sessions: SessionView[]): DailyActivity[] {
  const start = windowStart(now, windowDays);
  const days: DailyActivity[] = [];
  for (let offset = 0; offset < windowDays; offset += 1) {
    const day = new Date(start + offset * 86_400_000);
    days.push({ date: day.toISOString().slice(0, 10), sessions: 0, pullRequests: 0 });
  }

  const index = new Map(days.map((day) => [day.date, day]));
  for (const session of sessions) {
    const day = index.get(session.createdAt.slice(0, 10));
    if (!day) continue;
    day.sessions += 1;
    if (session.pullRequestUrl) day.pullRequests += 1;
  }

  return days;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? Math.round((sorted[mid - 1] + sorted[mid]) / 2) : sorted[mid];
}

function roundAcus(value: number): number {
  return Math.round(value * 100) / 100;
}

function medianAcus(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const value = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  return roundAcus(value);
}

function buildSpend(sessions: SessionView[]): DashboardData["spend"] {
  const withSpend = sessions.filter((session) => session.acusConsumed !== null);
  const values = withSpend.map((session) => session.acusConsumed as number);
  const totalAcus = roundAcus(values.reduce((sum, value) => sum + value, 0));
  const topSessions = [...withSpend]
    .sort((a, b) => (b.acusConsumed as number) - (a.acusConsumed as number))
    .slice(0, 5)
    .map((session) => ({
      id: session.id,
      url: session.url,
      title: session.title,
      status: session.status,
      acusConsumed: session.acusConsumed as number,
      durationMinutes: session.durationMinutes,
    }));

  return {
    available: withSpend.length > 0,
    totalAcus,
    averageAcus: values.length ? roundAcus(totalAcus / values.length) : 0,
    medianAcus: medianAcus(values),
    maxAcus: values.length ? roundAcus(Math.max(...values)) : 0,
    sessionsWithSpend: withSpend.length,
    topSessions,
  };
}

export function buildDashboard(
  rawSessions: DevinSession[],
  options: { source: "live" | "mock"; windowDays?: number; now?: number },
): DashboardData {
  const now = options.now ?? Date.now();
  const windowDays = options.windowDays ?? 7;
  const cutoff = windowStart(now, windowDays);

  const sessions = rawSessions
    .map(toSessionView)
    .filter((session) => new Date(session.createdAt).getTime() >= cutoff)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const pullRequests: PullRequestView[] = sessions
    .filter((session) => session.pullRequestUrl)
    .map((session) => {
      const { repo, number } = parsePullRequest(session.pullRequestUrl as string);
      return {
        url: session.pullRequestUrl as string,
        repo,
        number,
        sessionId: session.id,
        sessionTitle: session.title,
        createdAt: session.createdAt,
      };
    });

  const issues = detectIssues(sessions, now);
  const finished = sessions.filter((session) => session.status === "finished");
  const active = sessions.filter(
    (session) => session.status === "working" || session.status === "blocked",
  );

  const statusOrder: SessionStatus[] = [
    "working",
    "blocked",
    "finished",
    "expired",
    "suspended",
    "unknown",
  ];
  const statusBreakdown = statusOrder
    .map((status) => ({
      status,
      count: sessions.filter((session) => session.status === status).length,
    }))
    .filter((entry) => entry.count > 0);

  return {
    source: options.source,
    generatedAt: new Date(now).toISOString(),
    windowDays,
    totals: {
      sessions: sessions.length,
      activeSessions: active.length,
      finishedSessions: finished.length,
      pullRequests: pullRequests.length,
      issues: issues.length,
      successRate: sessions.length ? Math.round((finished.length / sessions.length) * 100) : 0,
      prRate: sessions.length ? Math.round((pullRequests.length / sessions.length) * 100) : 0,
      medianDurationMinutes: median(finished.map((session) => session.durationMinutes)),
    },
    statusBreakdown,
    activity: buildActivity(windowDays, now, sessions),
    sessions,
    pullRequests,
    issues,
    spend: buildSpend(sessions),
  };
}
