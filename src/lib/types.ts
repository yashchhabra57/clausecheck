/**
 * Core domain types shared by the analyzer, the API and the UI.
 */

/**
 * How serious a finding is.
 * - `void`:   the clause matches a provision that Wis. Stat. 704.44 says makes
 *             the whole rental agreement void and unenforceable.
 * - `high`:   likely unlawful or seriously one-sided; worth pushing back on.
 * - `review`: not necessarily unlawful, but the tenant should read it closely.
 */
export type Severity = "void" | "high" | "review";

export interface Citation {
  /** Human-readable reference, e.g. "Wis. Stat. § 704.44(5m)". */
  code: string;
  /** Link to the official source text. */
  url: string;
}

export interface Clause {
  /** Stable id within one analysis, e.g. "c7". */
  id: string;
  /** Zero-based position in the document. */
  index: number;
  /** Section heading or number if the segmenter found one. */
  heading: string | null;
  /** Clause body, whitespace-normalized. */
  text: string;
  /** Character offsets into the normalized document text. */
  start: number;
  end: number;
}

export interface Rule {
  id: string;
  title: string;
  severity: Severity;
  citation: Citation;
  /** Plain-English explanation shown to the tenant. */
  explanation: string;
  /** What the tenant can actually do about it. */
  tenantAction: string;
  /**
   * Returns the matched text if the clause triggers this rule, otherwise null.
   * Detectors run on a single clause at a time.
   */
  detect: (clauseText: string) => string | null;
}

export type FindingSource = "rules" | "ai" | "both";

export interface Finding {
  /** Rule id, or "ai:other" for AI findings outside the rule catalog. */
  ruleId: string;
  clauseId: string;
  severity: Severity;
  title: string;
  citation: Citation | null;
  explanation: string;
  tenantAction: string;
  /** The exact span of clause text that triggered the finding. */
  evidence: string;
  source: FindingSource;
}

export interface RiskScore {
  /** 0 (worst) to 100 (no issues found). */
  value: number;
  grade: "A" | "B" | "C" | "D" | "F";
  counts: Record<Severity, number>;
}

export interface AnalysisResult {
  clauses: Clause[];
  findings: Finding[];
  score: RiskScore;
  /** Optional plain-English overview written by the AI reviewer. */
  summary: string | null;
  meta: {
    aiUsed: boolean;
    /** Why the AI pass was skipped or failed, if it was. */
    aiNote: string | null;
    pageCount: number | null;
    durationMs: number;
    jurisdiction: "WI";
  };
}
