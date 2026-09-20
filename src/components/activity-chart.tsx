import type { DailyActivity } from "@/lib/devin/types";

export function ActivityChart({ activity }: { activity: DailyActivity[] }) {
  const max = Math.max(1, ...activity.map((day) => day.sessions));

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
      <header className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-slate-200">Daily activity</h2>
        <p className="text-xs text-slate-500">sessions vs. pull requests</p>
      </header>
      <div className="mt-6 flex h-40 items-end gap-3">
        {activity.map((day) => (
          <div key={day.date} className="flex flex-1 flex-col items-center gap-2">
            <div className="flex h-full w-full items-end justify-center gap-1">
              <div
                className="w-1/3 rounded-t bg-sky-500/70"
                style={{ height: `${(day.sessions / max) * 100}%` }}
                title={`${day.sessions} sessions`}
              />
              <div
                className="w-1/3 rounded-t bg-emerald-500/70"
                style={{ height: `${(day.pullRequests / max) * 100}%` }}
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
