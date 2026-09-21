"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { DEVIN_MODES, type CreatedSessionView, type DevinMode } from "@/lib/devin/types";

const MODE_LABELS: Record<DevinMode, string> = {
  normal: "Normal (default)",
  fast: "Fast",
  lite: "Lite",
  ultra: "Ultra",
  fusion: "Fusion",
};

type FormState = "idle" | "submitting" | "success" | "error";

export function NewSessionForm({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [prompt, setPrompt] = useState("");
  const [mode, setMode] = useState<DevinMode>("normal");
  const [state, setState] = useState<FormState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [createdSession, setCreatedSession] = useState<CreatedSessionView | null>(null);

  const submit = async () => {
    if (state === "submitting" || !prompt.trim() || !enabled) return;

    setState("submitting");
    setError(null);
    setCreatedSession(null);
    try {
      const response = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim(), devinMode: mode }),
      });
      const payload = (await response.json()) as CreatedSessionView | { error?: string };
      if (!response.ok) {
        throw new Error("error" in payload && payload.error ? payload.error : "Could not create session.");
      }

      setPrompt("");
      setCreatedSession(payload as CreatedSessionView);
      setState("success");
      router.refresh();
      textareaRef.current?.focus();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create session.");
      setState("error");
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void submit();
  };

  return (
    <section className="mt-6 min-w-0 rounded-xl border border-slate-800 bg-slate-900/60 p-5">
      <header>
        <h2 className="text-sm font-semibold text-slate-200">New session</h2>
        <p className="mt-1 text-sm text-slate-500">
          Start a Devin session from a prompt. It appears in the table below once created.
        </p>
      </header>

      <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
        <div>
          <label htmlFor="session-prompt" className="text-xs font-medium text-slate-300">
            Prompt
          </label>
          <textarea
            ref={textareaRef}
            id="session-prompt"
            required
            rows={4}
            maxLength={10_000}
            disabled={!enabled || state === "submitting"}
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            onKeyDown={(event) => {
              if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
                event.preventDefault();
                void submit();
              }
            }}
            placeholder="Describe the task for Devin…"
            className="mt-2 block w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-slate-500 focus:ring-1 focus:ring-slate-500 disabled:cursor-not-allowed disabled:opacity-60"
          />
        </div>

        <div className="max-w-xs">
          <label htmlFor="session-mode" className="text-xs font-medium text-slate-300">
            Mode
          </label>
          <select
            id="session-mode"
            required
            disabled={!enabled || state === "submitting"}
            value={mode}
            onChange={(event) => setMode(event.target.value as DevinMode)}
            className="mt-2 block w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {DEVIN_MODES.map((option) => (
              <option key={option} value={option}>
                {MODE_LABELS[option]}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          disabled={!enabled || state === "submitting" || !prompt.trim()}
          className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {state === "submitting" ? "Creating…" : "Create session"}
        </button>
      </form>

      {!enabled ? (
        <p className="mt-4 text-xs text-slate-500">
          Set DEVIN_API_KEY and DEVIN_ORG_ID to create sessions.
        </p>
      ) : null}
      {state === "success" && createdSession ? (
        <p
          role="status"
          className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300"
        >
          Session created ·{" "}
          <a
            href={createdSession.url}
            target="_blank"
            rel="noreferrer"
            className="font-medium underline underline-offset-2"
          >
            Open session
          </a>
        </p>
      ) : null}
      {state === "error" && error ? (
        <p
          role="alert"
          className="mt-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300"
        >
          {error}
        </p>
      ) : null}
    </section>
  );
}
