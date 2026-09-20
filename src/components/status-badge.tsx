import type { SessionStatus } from "@/lib/devin/types";

const STATUS_CLASSES: Record<SessionStatus, string> = {
  working: "bg-sky-500/15 text-sky-300 ring-sky-500/30",
  blocked: "bg-rose-500/15 text-rose-300 ring-rose-500/30",
  finished: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
  expired: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
  suspended: "bg-violet-500/15 text-violet-300 ring-violet-500/30",
  unknown: "bg-slate-500/15 text-slate-300 ring-slate-500/30",
};

export function StatusBadge({ status }: { status: SessionStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS_CLASSES[status]}`}
    >
      {status}
    </span>
  );
}
