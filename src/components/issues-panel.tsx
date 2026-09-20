import type { AgentIssue } from "@/lib/devin/types";

const SEVERITY_CLASSES: Record<AgentIssue["severity"], string> = {
  critical: "border-rose-500/40 bg-rose-500/10 text-rose-300",
  warning: "border-amber-500/40 bg-amber-500/10 text-amber-300",
};

export function IssuesPanel({ issues }: { issues: AgentIssue[] }) {
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
      <header className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-slate-200">Agent issues</h2>
        <p className="text-xs text-slate-500">{issues.length} detected</p>
      </header>

      {issues.length === 0 ? (
        <p className="mt-6 text-sm text-slate-500">No issues detected in this window.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {issues.slice(0, 8).map((issue) => (
            <li
              key={issue.id}
              className={`rounded-lg border p-3 ${SEVERITY_CLASSES[issue.severity]}`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold uppercase tracking-wide">
                  {issue.kind.replace("_", " ")}
                </span>
                <time className="text-[11px] text-slate-400">
                  {new Date(issue.detectedAt).toLocaleString()}
                </time>
              </div>
              <p className="mt-1 text-sm text-slate-200">{issue.summary}</p>
              <a
                href={issue.sessionUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-block text-xs text-slate-400 underline underline-offset-2 hover:text-slate-200"
              >
                {issue.sessionTitle}
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
