import { formatAcus, formatMinutes } from "@/lib/devin/metrics";
import type { SessionView } from "@/lib/devin/types";
import { StatusBadge } from "./status-badge";

export function SessionsTable({ sessions }: { sessions: SessionView[] }) {
  return (
    <section className="min-w-0 overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60">
      <header className="flex items-baseline justify-between border-b border-slate-800 p-5">
        <h2 className="text-sm font-semibold text-slate-200">Recent sessions</h2>
        <p className="text-xs text-slate-500">showing {Math.min(sessions.length, 15)}</p>
      </header>

      {sessions.length === 0 ? (
        <p className="p-5 text-sm text-slate-500">No sessions in this window.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3 font-medium">Session</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Duration</th>
                <th className="px-5 py-3 font-medium">ACUs</th>
                <th className="px-5 py-3 font-medium">PR</th>
                <th className="px-5 py-3 font-medium">Started</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {sessions.slice(0, 15).map((session) => (
                <tr key={session.id} className="hover:bg-slate-800/40">
                  <td className="max-w-[220px] px-5 py-3">
                    <a
                      href={session.url}
                      target="_blank"
                      rel="noreferrer"
                      className="block truncate text-slate-200 hover:text-sky-300"
                    >
                      {session.title}
                    </a>
                    <span className="text-xs text-slate-500">
                      {session.requestedBy ?? "unknown requester"}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <StatusBadge status={session.status} />
                  </td>
                  <td className="px-5 py-3 tabular-nums text-slate-300">
                    {formatMinutes(session.durationMinutes)}
                  </td>
                  <td className="px-5 py-3 tabular-nums text-slate-300">
                    {session.acusConsumed !== null ? (
                      formatAcus(session.acusConsumed)
                    ) : (
                      <span className="text-slate-600">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    {session.pullRequestUrl ? (
                      <a
                        href={session.pullRequestUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sky-300 hover:underline"
                      >
                        open
                      </a>
                    ) : (
                      <span className="text-slate-600">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-xs text-slate-400">
                    {new Date(session.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
