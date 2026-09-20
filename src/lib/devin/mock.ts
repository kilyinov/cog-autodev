import type { DevinSessionSummary } from "./types";

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
const USERS = ["konstantin.ilinov@gmail.com", "agent-runner@cog-autodev.dev"];
const TAG_POOL = ["nightly", "triage", "ci", "backlog", "playbook:review"];
const STATUSES = [
  "finished",
  "finished",
  "finished",
  "finished",
  "working",
  "working",
  "blocked",
  "expired",
] as const;

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
export function mockSessions(count = 90, now = Date.now()): DevinSessionSummary[] {
  const random = mulberry32(1337);
  const sessions: DevinSessionSummary[] = [];

  for (let i = 0; i < count; i += 1) {
    const status = pick(random, STATUSES);
    const ageMinutes = Math.floor(random() * 60 * 24 * 30);
    const durationMinutes = 8 + Math.floor(random() * 220);
    const createdAt = new Date(now - ageMinutes * 60_000);
    const updatedAt = new Date(
      Math.min(now, createdAt.getTime() + durationMinutes * 60_000),
    );
    const hasPr = status === "finished" ? random() < 0.72 : random() < 0.12;
    const repo = pick(random, REPOS);

    sessions.push({
      session_id: `devin-${(i + 1).toString().padStart(4, "0")}${Math.floor(random() * 1e6)
        .toString(16)
        .padStart(5, "0")}`,
      status,
      status_enum: status,
      title: pick(random, TITLES),
      created_at: createdAt.toISOString(),
      updated_at: updatedAt.toISOString(),
      requesting_user_email: pick(random, USERS),
      playbook_id: random() < 0.4 ? `playbook-${Math.floor(random() * 900 + 100)}` : null,
      snapshot_id: null,
      tags: random() < 0.6 ? [pick(random, TAG_POOL)] : [],
      pull_request: hasPr
        ? { url: `https://github.com/${repo}/pull/${1200 + Math.floor(random() * 400)}` }
        : null,
    });
  }

  return sessions.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}
