"use client";

import { useRef, useState } from "react";

export const SAMPLES = [
  { file: "predatory-lease.txt", label: "Predatory lease" },
  { file: "student-house-lease.txt", label: "Student house" },
  { file: "reworded-lease.txt", label: "Reworded clauses" },
  { file: "fair-lease.txt", label: "Fair lease" },
] as const;

export type Submission =
  | { kind: "file"; file: File; useAi: boolean }
  | { kind: "text"; text: string; useAi: boolean };

export function UploadPanel({
  busy,
  onSubmit,
}: {
  busy: boolean;
  onSubmit: (s: Submission) => void;
}) {
  const [text, setText] = useState("");
  const [useAi, setUseAi] = useState(true);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (file) onSubmit({ kind: "file", file, useAi });
  }

  async function loadSample(file: string) {
    const res = await fetch(`/samples/${file}`);
    const sample = await res.text();
    setText(sample);
    onSubmit({ kind: "text", text: sample, useAi });
  }

  return (
    <section className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5 sm:p-6">
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload a lease PDF or text file"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-8 text-center transition ${
          dragging
            ? "border-sky-500 bg-sky-50 dark:bg-sky-500/10"
            : "border-black/15 hover:border-black/30 dark:border-white/15 dark:hover:border-white/30"
        }`}
      >
        <p className="font-medium">Drop your lease PDF here, or click to choose a file</p>
        <p className="mt-1 text-sm text-black/55 dark:text-white/55">PDF or .txt, up to 10 MB</p>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf,text/plain,.txt"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      <div className="my-4 flex items-center gap-3 text-xs uppercase tracking-wide text-black/40 dark:text-white/40">
        <span className="h-px flex-1 bg-black/10 dark:bg-white/10" /> or paste the text
        <span className="h-px flex-1 bg-black/10 dark:bg-white/10" />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim()) onSubmit({ kind: "text", text, useAi });
        }}
      >
        <label htmlFor="lease-text" className="sr-only">
          Lease text
        </label>
        <textarea
          id="lease-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={7}
          placeholder="Paste the full lease here…"
          className="w-full resize-y rounded-xl border border-black/15 bg-transparent p-3 font-mono text-sm outline-none focus:border-sky-500 dark:border-white/15"
        />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={useAi}
              onChange={(e) => setUseAi(e.target.checked)}
              className="size-4 accent-sky-600"
            />
            AI review (catches reworded clauses)
          </label>
          <button
            type="submit"
            disabled={busy || !text.trim()}
            className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
          >
            {busy ? "Analyzing…" : "Check this lease"}
          </button>
        </div>
      </form>

      <div className="mt-5 border-t border-black/10 pt-4 dark:border-white/10">
        <p className="mb-2 text-sm text-black/55 dark:text-white/55">No lease handy? Try a sample:</p>
        <div className="flex flex-wrap gap-2">
          {SAMPLES.map((s) => (
            <button
              key={s.file}
              type="button"
              disabled={busy}
              onClick={() => loadSample(s.file)}
              className="rounded-full border border-black/15 px-3 py-1 text-sm transition hover:bg-black/5 disabled:opacity-40 dark:border-white/15 dark:hover:bg-white/10"
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
