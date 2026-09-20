export type SessionStatus =
  | "working"
  | "blocked"
  | "expired"
  | "finished"
  | "suspended"
  | "unknown";

export type PullRequestInfo = {
  url: string;
};

/** Shape returned by `GET /v1/sessions` on the Devin API. */
export type DevinSessionSummary = {
  session_id: string;
  status: string;
  status_enum: string | null;
  title: string | null;
  created_at: string;
  updated_at: string;
  requesting_user_email: string | null;
  playbook_id: string | null;
  snapshot_id: string | null;
  tags: string[] | null;
  pull_request: PullRequestInfo | null;
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
