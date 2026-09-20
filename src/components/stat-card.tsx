type StatCardProps = {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "neutral" | "positive" | "warning" | "critical";
};

const TONE_CLASSES: Record<NonNullable<StatCardProps["tone"]>, string> = {
  neutral: "text-slate-100",
  positive: "text-emerald-400",
  warning: "text-amber-400",
  critical: "text-rose-400",
};

export function StatCard({ label, value, hint, tone = "neutral" }: StatCardProps) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-2 text-3xl font-semibold tabular-nums ${TONE_CLASSES[tone]}`}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}
