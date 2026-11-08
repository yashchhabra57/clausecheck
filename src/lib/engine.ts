import { WISCONSIN_RULES } from "./rules/wisconsin";
import type { Clause, Finding, RiskScore, Rule, Severity } from "./types";

export const SEVERITY_ORDER: Record<Severity, number> = {
  void: 0,
  high: 1,
  review: 2,
};

/** Points subtracted from 100 for each distinct rule that fires. */
const PENALTY: Record<Severity, number> = {
  void: 25,
  high: 12,
  review: 5,
};

/**
 * Widen a regex match out to the surrounding sentence so the evidence shown
 * to the user reads naturally.
 */
export function sentenceAround(text: string, match: string): string {
  const at = text.indexOf(match);
  if (at === -1) return match;
  const before = text.slice(0, at);
  const startCandidates = [before.lastIndexOf(". "), before.lastIndexOf("; ")];
  const start = Math.max(...startCandidates);
  const sentenceStart = start === -1 ? 0 : start + 2;
  const afterIdx = text.slice(at + match.length).search(/[.;](?:\s|$)/);
  const sentenceEnd =
    afterIdx === -1 ? text.length : at + match.length + afterIdx + 1;
  return text.slice(sentenceStart, sentenceEnd).trim();
}

/** Run every rule against every clause. One finding per (rule, clause). */
export function runRules(
  clauses: Clause[],
  rules: Rule[] = WISCONSIN_RULES,
): Finding[] {
  const findings: Finding[] = [];
  for (const clause of clauses) {
    for (const rule of rules) {
      const match = rule.detect(clause.text);
      if (!match) continue;
      findings.push({
        ruleId: rule.id,
        clauseId: clause.id,
        severity: rule.severity,
        title: rule.title,
        citation: rule.citation,
        explanation: rule.explanation,
        tenantAction: rule.tenantAction,
        evidence: sentenceAround(clause.text, match),
        source: "rules",
      });
    }
  }
  return sortFindings(findings, clauses);
}

/** Order by severity, then by where the clause appears in the lease. */
export function sortFindings(findings: Finding[], clauses: Clause[]): Finding[] {
  const position = new Map(clauses.map((c) => [c.id, c.index]));
  return [...findings].sort(
    (a, b) =>
      SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
      (position.get(a.clauseId) ?? 0) - (position.get(b.clauseId) ?? 0),
  );
}

/**
 * Turn findings into a 0–100 score. Each distinct issue is penalized once, so
 * a lease that repeats the same bad clause twice isn't double-counted.
 */
export function scoreFindings(findings: Finding[]): RiskScore {
  const counts: Record<Severity, number> = { void: 0, high: 0, review: 0 };
  const seen = new Set<string>();
  let penalty = 0;

  for (const f of findings) {
    counts[f.severity]++;
    const key = f.ruleId === "ai:other" ? `${f.ruleId}:${f.clauseId}` : f.ruleId;
    if (seen.has(key)) continue;
    seen.add(key);
    penalty += PENALTY[f.severity];
  }

  const value = Math.max(0, 100 - penalty);
  const grade =
    value >= 90 ? "A" : value >= 75 ? "B" : value >= 60 ? "C" : value >= 40 ? "D" : "F";
  return { value, grade, counts };
}
