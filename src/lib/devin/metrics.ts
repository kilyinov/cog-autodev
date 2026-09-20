import type {
  AgentIssue,
  DailyActivity,
  DashboardData,
  DevinSessionSummary,
  PullRequestView,
  SessionStatus,
  SessionView,
} from "./types";

const STALLED_AFTER_MINUTES = 240;

function normalizeStatus(session: DevinSessionSummary): SessionStatus {
  const raw = (session.status_enum ?? session.status ?? "").toLowerCase();
  if (raw.startsWith("suspend") || raw.startsWith("resum")) return "suspended";
  if (raw === "working" || raw === "running" || raw === "claimed") return "working";
  if (raw === "blocked") return "blocked";
  if (raw === "expired" || raw === "error") return "expired";
  if (raw === "finished" || raw === "exit") return "finished";
  return "unknown";
}

function minutesBetween(from: string, to: string): number {
  return Math.max(0, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 60_000));
}

function parsePullRequest(url: string): { repo: string; number: string } {
  const match = url.match(/github\.com\/([^/]+\/[^/]+)\/pull\/(\d+)/);
  if (match) return { repo: match[1], number: match[2] };
  return { repo: url.replace(/^https?:\/\//, "").split("/").slice(0, 2).join("/"), number: "" };
}

function toSessionView(session: DevinSessionSummary): SessionView {
  return {
    id: session.session_id,
    url: `https://app.devin.ai/sessions/${session.session_id.replace(/^devin-/, "")}`,
    title: session.title?.trim() || "Untitled session",
    status: normalizeStatus(session),
    rawStatus: session.status_enum ?? session.status,
    createdAt: session.created_at,
    updatedAt: session.updated_at,
    durationMinutes: minutesBetween(session.created_at, session.updated_at),
    requestedBy: session.requesting_user_email,
    tags: session.tags ?? [],
    pullRequestUrl: session.pull_request?.url ?? null,
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

export function buildDashboard(
  rawSessions: DevinSessionSummary[],
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
  };
}
