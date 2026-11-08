import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it, vi } from "vitest";
import { runRules } from "../engine";
import { normalizeText, segmentClauses } from "../segment";
import { isGrounded, mergeFindings, reviewWithAi, toFindings } from "./review";

const clauses = segmentClauses(
  normalizeText(`1. DEFAULT. Should Tenant default, Landlord may collect every remaining monthly payment for the rest of the term right away.
2. FEES. Tenant agrees to a confession of judgment in favor of Landlord.
3. ENTRY. Landlord may enter the unit at any time for any reason.`),
);

describe("isGrounded", () => {
  it("accepts verbatim quotes regardless of case and spacing", () => {
    expect(isGrounded("LANDLORD may  enter the unit", clauses[2].text)).toBe(true);
  });
  it("rejects paraphrases and tiny quotes", () => {
    expect(isGrounded("landlord can come in whenever", clauses[2].text)).toBe(false);
    expect(isGrounded("unit", clauses[2].text)).toBe(false);
  });
});

describe("toFindings", () => {
  it("drops hallucinated quotes and unknown clauses, trusts catalog metadata", () => {
    const { findings, dropped } = toFindings(
      {
        summary: "s",
        findings: [
          {
            clauseId: "c1",
            ruleId: "wi-rent-acceleration",
            severity: "review", // ignored for catalog rules
            title: "ignored",
            explanation: "ignored",
            evidence: "Landlord may collect every remaining monthly payment for the rest of the term right away",
          },
          {
            clauseId: "c3",
            ruleId: "other",
            severity: "high",
            title: "Unlimited landlord entry",
            explanation: "No notice requirement.",
            evidence: "Landlord may enter the unit at any time for any reason",
          },
          {
            clauseId: "c2",
            ruleId: "wi-attorney-fees",
            severity: "high",
            title: "x",
            explanation: "x",
            evidence: "Tenant shall pay attorney fees", // not in the clause
          },
          {
            clauseId: "c99",
            ruleId: "other",
            severity: "high",
            title: "x",
            explanation: "x",
            evidence: "anything at all here",
          },
        ],
      },
      clauses,
    );
    expect(dropped).toBe(2);
    expect(findings).toHaveLength(2);
    expect(findings[0]).toMatchObject({
      ruleId: "wi-rent-acceleration",
      severity: "void",
      citation: { code: "Wis. Stat. § 704.44(3m)" },
      source: "ai",
    });
    expect(findings[1]).toMatchObject({ ruleId: "ai:other", severity: "high", citation: null });
  });
});

describe("mergeFindings", () => {
  it("marks overlaps as confirmed by both and appends new AI findings", () => {
    const ruleFindings = runRules(clauses);
    expect(ruleFindings.map((f) => f.ruleId)).toEqual(["wi-confession-of-judgment"]);
    const { findings: ai } = toFindings(
      {
        summary: "",
        findings: [
          { clauseId: "c2", ruleId: "wi-confession-of-judgment", severity: "high", title: "", explanation: "", evidence: "confession of judgment in favor of Landlord" },
          { clauseId: "c1", ruleId: "wi-rent-acceleration", severity: "high", title: "", explanation: "", evidence: "collect every remaining monthly payment" },
        ],
      },
      clauses,
    );
    const merged = mergeFindings(ruleFindings, ai);
    expect(merged.map((f) => [f.ruleId, f.source])).toEqual([
      ["wi-confession-of-judgment", "both"],
      ["wi-rent-acceleration", "ai"],
    ]);
    // Original rule findings are not mutated.
    expect(ruleFindings[0].source).toBe("rules");
  });
});

function fakeClient(parse: (...args: unknown[]) => unknown): Anthropic {
  return { beta: { messages: { parse: vi.fn(parse) } } } as unknown as Anthropic;
}

describe("reviewWithAi", () => {
  it("returns grounded findings from a parsed response", async () => {
    const client = fakeClient(async () => ({
      stop_reason: "end_turn",
      parsed_output: {
        summary: "One big problem.",
        findings: [
          { clauseId: "c3", ruleId: "other", severity: "review", title: "Entry", explanation: "e", evidence: "enter the unit at any time" },
        ],
      },
    }));
    const result = await reviewWithAi(clauses, client);
    expect(result).toMatchObject({ ok: true, summary: "One big problem.", dropped: 0 });
  });

  it("degrades gracefully on refusal", async () => {
    const client = fakeClient(async () => ({ stop_reason: "refusal", parsed_output: null }));
    const result = await reviewWithAi(clauses, client);
    expect(result.ok).toBe(false);
  });

  it("never throws on unexpected errors", async () => {
    const client = fakeClient(async () => {
      throw new Error("boom");
    });
    await expect(reviewWithAi(clauses, client)).resolves.toMatchObject({ ok: false });
  });
});
