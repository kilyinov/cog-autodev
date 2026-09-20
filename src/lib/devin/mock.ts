import type { DevinSession } from "./types";

const TITLES = [
  "Fix flaky checkout integration test",
  "Upgrade Next.js to latest major",
  "Add retry logic to billing webhook",
  "Migrate user service to Postgres 16",
  "Triage Sentry spike in auth service",
  "Backfill analytics events for Q3",
  "Document deployment runbook",
  "Refactor feature flag client",
  "Add e2e coverage for onboarding",
  "Investigate slow dashboard query",
  "Bump vulnerable transitive deps",
  "Generate unit tests for pricing module",
];

const REPOS = ["kilyinov/cog-autodev", "kilyinov/platform-api", "kilyinov/web-app"];
const USERS = ["user-3f9a1c2e4b5d4a6f8e7c9b0d1a2f3e4c", "user-7a3c0f2e9d1b4c5aa8e6f0b2d4c6e8a0"];
const TAG_POOL = ["nightly", "triage", "ci", "backlog", "playbook:review"];
/** `[status, status_detail]` pairs as returned by the v3 sessions API. */
const STATUSES: readonly [string, string | null][] = [
  ["exit", null],
  ["exit", null],
  ["exit", null],
  ["running", "finished"],
  ["running", "working"],
  ["running", "working"],
  ["running", "waiting_for_user"],
  ["error", null],
];

/** Deterministic PRNG so server and client renders agree and demos are stable. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(random: () => number, values: readonly T[]): T {
  return values[Math.floor(random() * values.length)];
}

/**
 * Builds a plausible set of session summaries matching the Devin API shape, so
 * the control plane is explorable without an API key.
 */
export function mockSessions(count = 90, now = Date.now()): DevinSession[] {
  const random = mulberry32(1337);
  const sessions: DevinSession[] = [];

  for (let i = 0; i < count; i += 1) {
    const [status, statusDetail] = pick(random, STATUSES);
    const isFinished = status === "exit" || statusDetail === "finished";
    const durationMinutes = 8 + Math.floor(random() * 220);
    const dayOffset = Math.floor(random() * 30);
    const todayStart = new Date(now).setUTCHours(0, 0, 0, 0);
    const startOfDay = todayStart - dayOffset * 86_400_000;
    const spanMs = dayOffset === 0 ? Math.max(60_000, now - todayStart) : 86_400_000;
    const createdAt = new Date(startOfDay + Math.floor(random() * spanMs));
    const updatedAt = new Date(
      Math.min(now, createdAt.getTime() + durationMinutes * 60_000),
    );
    const hasPr = isFinished ? random() < 0.72 : random() < 0.12;
    const repo = pick(random, REPOS);
    const sessionId = `devin-${(i + 1).toString().padStart(4, "0")}${Math.floor(random() * 1e6)
      .toString(16)
      .padStart(5, "0")}`;

    sessions.push({
      session_id: sessionId,
      url: `https://app.devin.ai/sessions/${sessionId.replace(/^devin-/, "")}`,
      status,
      status_detail: statusDetail,
      title: pick(random, TITLES),
      created_at: Math.floor(createdAt.getTime() / 1000),
      updated_at: Math.floor(updatedAt.getTime() / 1000),
      user_id: pick(random, USERS),
      playbook_id: random() < 0.4 ? `playbook-${Math.floor(random() * 900 + 100)}` : null,
      tags: random() < 0.6 ? [pick(random, TAG_POOL)] : [],
      pull_requests: hasPr
        ? [
            {
              pr_url: `https://github.com/${repo}/pull/${1200 + Math.floor(random() * 400)}`,
              pr_state: "open",
            },
          ]
        : [],
    });
  }

  return sessions.sort((a, b) => b.created_at - a.created_at);
}
