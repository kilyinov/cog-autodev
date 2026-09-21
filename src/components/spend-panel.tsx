import { formatAcus, formatMinutes } from "@/lib/devin/metrics";
import type { DashboardData } from "@/lib/devin/types";
import { StatusBadge } from "./status-badge";

export function SpendPanel({ spend }: { spend: DashboardData["spend"] }) {
  return (
    <section className="min-w-0 rounded-xl border border-slate-800 bg-slate-900/60 p-5">
      <header className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-slate-200">Spend per session</h2>
        <p className="text-xs text-slate-500">{spend.sessionsWithSpend} sessions with usage data</p>
      </header>

      {!spend.available ? (
        <p className="mt-6 text-sm text-slate-500">
          No ACU usage data. Session insights require a service user with session-insights access.
        </p>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">Avg / session</p>
              <p className="text-xl font-semibold tabular-nums">{formatAcus(spend.averageAcus)} ACU</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">Median</p>
              <p className="text-xl font-semibold tabular-nums">{formatAcus(spend.medianAcus)} ACU</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">Max</p>
              <p className="text-xl font-semibold tabular-nums">{formatAcus(spend.maxAcus)} ACU</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">Total ACUs</p>
              <p className="text-xl font-semibold tabular-nums">{formatAcus(spend.totalAcus)}</p>
            </div>
          </div>

          <h3 className="mt-5 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Top sessions by spend
          </h3>
          <ul className="mt-2 space-y-2">
            {spend.topSessions.map((session) => (
              <li key={session.id} className="rounded-lg border border-slate-800 p-3">
                <div className="flex items-baseline justify-between gap-3">
                  <a
                    href={session.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block truncate text-sm font-medium text-sky-300 hover:underline"
                  >
                    {session.title}
                  </a>
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-200">
                    {formatAcus(session.acusConsumed)} ACU
                  </span>
                </div>
                <p className="mt-1 flex items-center gap-2 text-xs text-slate-400">
                  <StatusBadge status={session.status} />
                  <span className="tabular-nums">{formatMinutes(session.durationMinutes)}</span>
                </p>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
