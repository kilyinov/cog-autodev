import type { DailyActivity } from "@/lib/devin/types";

const CHART_HEIGHT_PX = 128;

function barHeight(value: number, max: number): number {
  if (value === 0) return 0;
  return Math.max(2, Math.round((value / max) * CHART_HEIGHT_PX));
}

export function ActivityChart({ activity }: { activity: DailyActivity[] }) {
  const max = Math.max(1, ...activity.map((day) => day.sessions));

  return (
    <section className="min-w-0 rounded-xl border border-slate-800 bg-slate-900/60 p-5">
      <header className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-slate-200">Daily activity</h2>
        <p className="text-xs text-slate-500">sessions vs. pull requests</p>
      </header>
      <div className="mt-6 flex items-end gap-2 overflow-x-auto pb-1">
        {activity.map((day) => (
          <div
            key={day.date}
            className="flex min-w-[18px] flex-1 shrink-0 flex-col items-center gap-2"
          >
            <div
              className="flex w-full items-end justify-center gap-1"
              style={{ height: `${CHART_HEIGHT_PX}px` }}
            >
              <div
                className="w-1/3 rounded-t bg-sky-500/70"
                style={{ height: `${barHeight(day.sessions, max)}px` }}
                title={`${day.sessions} sessions`}
              />
              <div
                className="w-1/3 rounded-t bg-emerald-500/70"
                style={{ height: `${barHeight(day.pullRequests, max)}px` }}
                title={`${day.pullRequests} pull requests`}
              />
            </div>
            <span className="text-[10px] text-slate-500">{day.date.slice(5)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
