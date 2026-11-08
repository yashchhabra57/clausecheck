"use client";

import { useMemo, useState } from "react";
import type { AnalysisResult, Clause, Finding, Severity } from "@/lib/types";
import {
  SEVERITY_BADGE,
  SEVERITY_BORDER,
  SEVERITY_LABEL,
  SEVERITY_MARK,
} from "./severity";

const GRADE_COLOR: Record<string, string> = {
  A: "text-emerald-600 dark:text-emerald-400",
  B: "text-lime-600 dark:text-lime-400",
  C: "text-amber-600 dark:text-amber-400",
  D: "text-orange-600 dark:text-orange-400",
  F: "text-red-600 dark:text-red-400",
};

const SOURCE_LABEL: Record<Finding["source"], string> = {
  rules: "Rule match",
  ai: "AI review",
  both: "Rule + AI",
};

function scrollToClause(id: string) {
  const el = document.getElementById(`clause-${id}`);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  el.classList.remove("flash");
  void el.offsetWidth; // restart the animation
  el.classList.add("flash");
}

/** Split clause text around the first case-insensitive match of `needle`. */
function splitOn(text: string, needle: string): [string, string, string] | null {
  const at = text.toLowerCase().indexOf(needle.toLowerCase().trim());
  if (at === -1 || !needle.trim()) return null;
  const end = at + needle.trim().length;
  return [text.slice(0, at), text.slice(at, end), text.slice(end)];
}

function ScoreCard({ result }: { result: AnalysisResult }) {
  const { score, meta } = result;
  return (
    <div className="flex flex-wrap items-center gap-6 rounded-2xl border border-black/10 bg-white p-5 dark:border-white/10 dark:bg-white/5">
      <div className="text-center">
        <div className={`text-5xl font-semibold tabular-nums ${GRADE_COLOR[score.grade]}`}>
          {score.grade}
        </div>
        <div className="mt-1 text-sm text-black/55 dark:text-white/55">{score.value}/100</div>
      </div>
      <dl className="grid flex-1 grid-cols-3 gap-3 text-center">
        {(["void", "high", "review"] as Severity[]).map((s) => (
          <div key={s} className="rounded-xl bg-black/[.03] p-3 dark:bg-white/5">
            <dt className="text-xs text-black/55 dark:text-white/55">{SEVERITY_LABEL[s]}</dt>
            <dd className="text-2xl font-semibold tabular-nums">{score.counts[s]}</dd>
          </div>
        ))}
      </dl>
      <p className="w-full text-xs text-black/50 dark:text-white/50">
        {result.clauses.length} clauses
        {meta.pageCount ? ` · ${meta.pageCount} pages` : ""} · {meta.durationMs} ms ·{" "}
        {meta.aiUsed ? "rules + AI review" : "rules only"}
        {meta.aiNote ? ` · ${meta.aiNote}` : ""}
      </p>
    </div>
  );
}

function FindingCard({ finding, clause }: { finding: Finding; clause?: Clause }) {
  return (
    <article
      className={`rounded-xl border border-black/10 border-l-4 bg-white p-4 dark:border-white/10 dark:bg-white/5 ${SEVERITY_BORDER[finding.severity]}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${SEVERITY_BADGE[finding.severity]}`}
        >
          {SEVERITY_LABEL[finding.severity]}
        </span>
        <span className="text-xs text-black/45 dark:text-white/45">{SOURCE_LABEL[finding.source]}</span>
      </div>
      <h3 className="mt-2 font-semibold">{finding.title}</h3>
      <blockquote className="mt-2 border-l-2 border-black/15 pl-3 text-sm italic text-black/70 dark:border-white/20 dark:text-white/70">
        “{finding.evidence}”
      </blockquote>
      <p className="mt-3 text-sm leading-relaxed">{finding.explanation}</p>
      <p className="mt-2 text-sm leading-relaxed">
        <span className="font-medium">What you can do: </span>
        {finding.tenantAction}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        {finding.citation && (
          <a
            href={finding.citation.url}
            target="_blank"
            rel="noreferrer"
            className="text-sky-700 underline-offset-2 hover:underline dark:text-sky-400"
          >
            {finding.citation.code} ↗
          </a>
        )}
        {clause && (
          <button
            type="button"
            onClick={() => scrollToClause(clause.id)}
            className="text-black/60 underline-offset-2 hover:underline dark:text-white/60"
          >
            Show in lease{clause.heading ? ` (${clause.heading})` : ""}
          </button>
        )}
      </div>
    </article>
  );
}

function LeaseView({ result }: { result: AnalysisResult }) {
  const byClause = useMemo(() => {
    const map = new Map<string, Finding[]>();
    for (const f of result.findings) {
      map.set(f.clauseId, [...(map.get(f.clauseId) ?? []), f]);
    }
    return map;
  }, [result.findings]);

  return (
    <ol className="space-y-2">
      {result.clauses.map((c) => {
        const findings = byClause.get(c.id) ?? [];
        const worst = findings[0]; // findings arrive sorted by severity
        const parts = worst ? splitOn(c.text, worst.evidence) : null;
        return (
          <li
            key={c.id}
            id={`clause-${c.id}`}
            className={`scroll-mt-24 rounded-lg p-3 text-sm leading-relaxed ${
              worst
                ? `border-l-4 bg-white dark:bg-white/5 ${SEVERITY_BORDER[worst.severity]}`
                : "text-black/60 dark:text-white/55"
            }`}
          >
            {parts ? (
              <>
                {parts[0]}
                <mark className={`rounded px-0.5 text-inherit ${SEVERITY_MARK[worst.severity]}`}>
                  {parts[1]}
                </mark>
                {parts[2]}
              </>
            ) : (
              c.text
            )}
            {findings.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {findings.map((f) => (
                  <span
                    key={f.ruleId}
                    className={`rounded-full px-2 py-0.5 text-xs ring-1 ring-inset ${SEVERITY_BADGE[f.severity]}`}
                  >
                    {f.title}
                  </span>
                ))}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function Report({ result }: { result: AnalysisResult }) {
  const [tab, setTab] = useState<"findings" | "lease">("findings");
  const clauses = useMemo(() => new Map(result.clauses.map((c) => [c.id, c])), [result.clauses]);

  return (
    <section className="space-y-4">
      <ScoreCard result={result} />

      {result.summary && (
        <div className="rounded-2xl border border-sky-600/20 bg-sky-50 p-4 text-sm leading-relaxed dark:bg-sky-500/10">
          <span className="font-medium">Summary: </span>
          {result.summary}
        </div>
      )}

      <div role="tablist" className="flex gap-1 rounded-lg bg-black/5 p-1 text-sm dark:bg-white/10">
        {(["findings", "lease"] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-md px-3 py-1.5 font-medium transition ${
              tab === t ? "bg-white shadow-sm dark:bg-neutral-800" : "text-black/60 dark:text-white/60"
            }`}
          >
            {t === "findings" ? `Findings (${result.findings.length})` : "Full lease"}
          </button>
        ))}
      </div>

      {tab === "findings" ? (
        result.findings.length === 0 ? (
          <p className="rounded-xl border border-emerald-600/20 bg-emerald-50 p-4 text-sm dark:bg-emerald-500/10">
            No red flags found. Still read the whole lease before you sign. ClauseCheck covers common
            problems, not every possible issue.
          </p>
        ) : (
          <div className="space-y-3">
            {result.findings.map((f) => (
              <FindingCard
                key={`${f.ruleId}-${f.clauseId}`}
                finding={f}
                clause={clauses.get(f.clauseId)}
              />
            ))}
          </div>
        )
      ) : (
        <LeaseView result={result} />
      )}
    </section>
  );
}
