"use client";

import { useState } from "react";
import { Report } from "@/components/Report";
import { type Submission, UploadPanel } from "@/components/UploadPanel";
import type { AnalysisResult } from "@/lib/types";

export default function Home() {
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function analyze(submission: Submission) {
    setBusy(true);
    setError(null);
    try {
      let res: Response;
      if (submission.kind === "file") {
        const form = new FormData();
        form.append("file", submission.file);
        form.append("useAi", String(submission.useAi));
        res = await fetch("/api/analyze", { method: "POST", body: form });
      } else {
        res = await fetch("/api/analyze", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text: submission.text, useAi: submission.useAi }),
        });
      }
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status}).`);
      setResult(body as AnalysisResult);
    } catch (err) {
      setResult(null);
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="mb-8 max-w-2xl">
        <p className="text-sm font-medium text-sky-700 dark:text-sky-400">ClauseCheck · Wisconsin</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
          Find the illegal clauses in your lease before you sign it.
        </h1>
        <p className="mt-3 text-black/65 dark:text-white/65">
          Upload a rental lease. ClauseCheck flags risky and unlawful terms, explains them in plain
          English, and links each one to the Wisconsin statute behind it.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="lg:sticky lg:top-6 lg:self-start">
          <UploadPanel busy={busy} onSubmit={analyze} />
          <p className="mt-3 text-xs leading-relaxed text-black/45 dark:text-white/45">
            ClauseCheck is an informational tool, not legal advice. Leases aren&apos;t stored. For help
            with a specific situation, contact Wisconsin legal aid or a tenant resource center.
          </p>
        </div>

        <div aria-live="polite">
          {error && (
            <p className="rounded-xl border border-red-600/20 bg-red-50 p-4 text-sm text-red-800 dark:bg-red-500/10 dark:text-red-300">
              {error}
            </p>
          )}
          {busy && !result && (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-28 animate-pulse rounded-xl bg-black/5 dark:bg-white/5" />
              ))}
            </div>
          )}
          {result && (
            <div className={busy ? "opacity-50 transition" : "transition"}>
              <Report result={result} />
            </div>
          )}
          {!result && !busy && !error && (
            <div className="flex h-full min-h-60 items-center justify-center rounded-2xl border border-dashed border-black/15 p-8 text-center text-sm text-black/50 dark:border-white/15 dark:text-white/50">
              Your report will appear here. Try the “Predatory lease” sample to see what ClauseCheck
              catches.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
