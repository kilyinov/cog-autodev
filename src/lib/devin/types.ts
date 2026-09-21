export type SessionStatus =
  | "working"
  | "blocked"
  | "expired"
  | "finished"
  | "suspended"
  | "unknown";

export type DevinMode = "normal" | "fast" | "lite" | "ultra" | "fusion";

export const DEVIN_MODES: readonly DevinMode[] = [
  "normal",
  "fast",
  "lite",
  "ultra",
  "fusion",
];

export type DevinPullRequest = {
  pr_url: string;
  pr_state: string | null;
};

/** Session item returned by `GET /v3/organizations/{org_id}/sessions`. */
export type DevinSession = {
  session_id: string;
  url: string;
  /** One of new, claimed, running, exit, error, suspended, resuming. */
  status: string;
  status_detail: string | null;
  title: string | null;
  /** Unix timestamp (seconds). */
  created_at: number;
  /** Unix timestamp (seconds). */
  updated_at: number;
  devin_mode?: DevinMode | null;
  user_id: string | null;
  playbook_id: string | null;
  tags: string[];
  pull_requests: DevinPullRequest[];
};

export type SessionView = {
  id: string;
  url: string;
  title: string;
  status: SessionStatus;
  rawStatus: string;
  createdAt: string;
  updatedAt: string;
  durationMinutes: number;
  requestedBy: string | null;
  tags: string[];
  pullRequestUrl: string | null;
};

export type CreatedSessionView = {
  sessionId: string;
  url: string;
  status: string;
  title: string | null;
  devinMode: DevinMode | null;
  createdAt: string;
};

export type PullRequestView = {
  url: string;
  repo: string;
  number: string;
  sessionId: string;
  sessionTitle: string;
  createdAt: string;
};

export type IssueSeverity = "critical" | "warning";

export type AgentIssue = {
  id: string;
  sessionId: string;
  sessionUrl: string;
  sessionTitle: string;
  severity: IssueSeverity;
  kind: "blocked" | "expired" | "stalled" | "no_output";
  summary: string;
  detectedAt: string;
};

export type DailyActivity = {
  date: string;
  sessions: number;
  pullRequests: number;
};

export type DashboardData = {
  source: "live" | "mock";
  generatedAt: string;
  windowDays: number;
  totals: {
    sessions: number;
    activeSessions: number;
    finishedSessions: number;
    pullRequests: number;
    issues: number;
    successRate: number;
    prRate: number;
    medianDurationMinutes: number;
  };
  statusBreakdown: { status: SessionStatus; count: number }[];
  activity: DailyActivity[];
  sessions: SessionView[];
  pullRequests: PullRequestView[];
  issues: AgentIssue[];
};
