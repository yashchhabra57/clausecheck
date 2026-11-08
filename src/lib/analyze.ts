import type Anthropic from "@anthropic-ai/sdk";
import { mergeFindings, reviewWithAi } from "./ai/review";
import { runRules, scoreFindings, sortFindings } from "./engine";
import { normalizeText, segmentClauses } from "./segment";
import type { AnalysisResult } from "./types";

export const MAX_TEXT_CHARS = 200_000;
export const MIN_TEXT_CHARS = 200;

export interface AnalyzeOptions {
  /** Run the AI review pass. Defaults to true when an API key is set. */
  useAi?: boolean;
  pageCount?: number | null;
  /** Injected for tests. */
  client?: Anthropic;
}

export class InputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InputError";
  }
}

export function aiAvailable(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/**
 * Full pipeline: normalize -> segment -> rules -> (optional) AI review ->
 * merge -> score.
 */
export async function analyzeLease(
  rawText: string,
  options: AnalyzeOptions = {},
): Promise<AnalysisResult> {
  const started = performance.now();
  const text = normalizeText(rawText);

  if (text.length < MIN_TEXT_CHARS) {
    throw new InputError("That's too short to be a lease. Paste the full text.");
  }
  if (text.length > MAX_TEXT_CHARS) {
    throw new InputError("That document is too long (over 200,000 characters).");
  }

  const clauses = segmentClauses(text);
  const ruleFindings = runRules(clauses);

  const wantAi = options.useAi ?? true;
  let findings = ruleFindings;
  let summary: string | null = null;
  let aiUsed = false;
  let aiNote: string | null = null;

  if (wantAi && (options.client || aiAvailable())) {
    const review = await reviewWithAi(clauses, options.client);
    if (review.ok) {
      findings = sortFindings(mergeFindings(ruleFindings, review.findings), clauses);
      summary = review.summary;
      aiUsed = true;
      if (review.dropped > 0) {
        aiNote = `Discarded ${review.dropped} AI finding(s) that didn't quote the lease exactly.`;
      }
    } else {
      aiNote = review.note;
    }
  } else if (wantAi) {
    aiNote = "AI review is off (no ANTHROPIC_API_KEY set). Showing rule-based results only.";
  }

  return {
    clauses,
    findings,
    score: scoreFindings(findings),
    summary,
    meta: {
      aiUsed,
      aiNote,
      pageCount: options.pageCount ?? null,
      durationMs: Math.round(performance.now() - started),
      jurisdiction: "WI",
    },
  };
}
