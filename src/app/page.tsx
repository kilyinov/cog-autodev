import Link from "next/link";
import { ActivityChart } from "@/components/activity-chart";
import { IssuesPanel } from "@/components/issues-panel";
import { PullRequestsPanel } from "@/components/pull-requests-panel";
import { RefreshButton } from "@/components/refresh-button";
import { SessionsTable } from "@/components/sessions-table";
import { StatCard } from "@/components/stat-card";
import { getDashboardData } from "@/lib/devin/dashboard";
import { formatMinutes } from "@/lib/devin/metrics";

export const dynamic = "force-dynamic";

const WINDOW_OPTIONS = [1, 7, 14, 30];

function parseWindow(value: string | string[] | undefined): number {
  const parsed = Number(Array.isArray(value) ? value[0] : value);
  return WINDOW_OPTIONS.includes(parsed) ? parsed : 7;
}

export default async function Home({ searchParams }: PageProps<"/">) {
  const windowDays = parseWindow((await searchParams).window);
  const { data, error } = await getDashboardData(windowDays);
  const { totals } = data;

  return (
    <div className="min-h-screen flex-1 bg-slate-950 text-slate-100">
      <div className="mx-auto w-full max-w-7xl px-6 py-10">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">cog-autodev control plane</h1>
            <p className="mt-1 text-sm text-slate-400">
              Devin workflow automation over the last {windowDays} day
              {windowDays === 1 ? "" : "s"} · updated{" "}
              {new Date(data.generatedAt).toLocaleString()}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <nav className="flex overflow-hidden rounded-lg border border-slate-800">
              {WINDOW_OPTIONS.map((option) => (
                <Link
                  key={option}
                  href={`/?window=${option}`}
                  className={`px-3 py-1.5 text-xs font-medium ${
                    option === windowDays
                      ? "bg-slate-800 text-slate-100"
                      : "text-slate-400 hover:bg-slate-900"
                  }`}
                >
                  {option}d
                </Link>
              ))}
            </nav>
            <RefreshButton />
          </div>
        </header>

        <div
          className={`mt-6 rounded-lg border px-4 py-3 text-xs ${
            data.source === "live"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
              : "border-amber-500/30 bg-amber-500/10 text-amber-200"
          }`}
        >
          {data.source === "live"
            ? "Live data from the Devin API."
            : "Demo data. Set DEVIN_API_KEY to show your organization's real sessions."}
          {error ? ` Devin API error: ${error}` : ""}
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Sessions"
            value={totals.sessions}
            hint={`${totals.activeSessions} active now`}
          />
          <StatCard
            label="Pull requests"
            value={totals.pullRequests}
            tone="positive"
            hint={`${totals.prRate}% of sessions opened a PR`}
          />
          <StatCard
            label="Agent issues"
            value={totals.issues}
            tone={totals.issues > 0 ? "critical" : "positive"}
            hint="blocked, expired, stalled or no output"
          />
          <StatCard
            label="Completion rate"
            value={`${totals.successRate}%`}
            hint={`median run ${formatMinutes(totals.medianDurationMinutes)}`}
          />
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <ActivityChart activity={data.activity} />
          </div>
          <IssuesPanel issues={data.issues} />
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <SessionsTable sessions={data.sessions} />
          </div>
          <PullRequestsPanel pullRequests={data.pullRequests} />
        </div>

        <footer className="mt-10 text-xs text-slate-600">
          Raw metrics available at{" "}
          <Link href="/api/dashboard" className="underline underline-offset-2">
            /api/dashboard
          </Link>
          .
        </footer>
      </div>
    </div>
  );
}
