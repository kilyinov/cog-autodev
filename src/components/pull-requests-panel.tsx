import type { PullRequestView } from "@/lib/devin/types";

export function PullRequestsPanel({ pullRequests }: { pullRequests: PullRequestView[] }) {
  return (
    <section className="min-w-0 rounded-xl border border-slate-800 bg-slate-900/60 p-5">
      <header className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-slate-200">Pull requests</h2>
        <p className="text-xs text-slate-500">{pullRequests.length} opened by sessions</p>
      </header>

      {pullRequests.length === 0 ? (
        <p className="mt-6 text-sm text-slate-500">No pull requests in this window.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {pullRequests.slice(0, 8).map((pr) => (
            <li key={pr.url} className="rounded-lg border border-slate-800 p-3">
              <a
                href={pr.url}
                target="_blank"
                rel="noreferrer"
                className="block truncate text-sm font-medium text-sky-300 hover:underline"
              >
                {pr.repo}
                {pr.number ? ` #${pr.number}` : ""}
              </a>
              <p className="mt-1 truncate text-xs text-slate-400">{pr.sessionTitle}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
