import { describe, expect, it } from "vitest";
import { runRules, scoreFindings, sentenceAround } from "./engine";
import { getRule, WISCONSIN_RULES } from "./rules/wisconsin";
import { normalizeText, segmentClauses } from "./segment";

function fires(ruleId: string, text: string): boolean {
  const rule = getRule(ruleId);
  if (!rule) throw new Error(`unknown rule ${ruleId}`);
  return rule.detect(text) !== null;
}

describe("rule detectors", () => {
  const cases: [string, string, boolean][] = [
    ["wi-confession-of-judgment", "Tenant hereby authorizes Landlord to confess judgment against Tenant.", true],
    ["wi-attorney-fees", "Tenant shall pay all of Landlord's attorney's fees incurred in enforcing this lease.", true],
    ["wi-attorney-fees", "Each party bears its own costs unless awarded by the court.", false],
    ["wi-rent-acceleration", "Upon default, the entire balance of rent for the term shall immediately become due and payable.", true],
    ["wi-rent-acceleration", "Landlord shall not be obligated to re-rent the premises.", true],
    ["wi-self-help-eviction", "If rent is late, Landlord may change the locks and remove Tenant's belongings without notice.", true],
    ["wi-negligence-waiver", "Landlord shall not be liable for any injury or damage to persons or property, including Landlord's own negligence.", true],
    ["wi-tenant-liable-beyond-control", "Tenant is responsible for all damage to the unit regardless of cause.", true],
    ["wi-habitability-waiver", "Tenant accepts the premises as-is and shall make all repairs.", true],
    ["wi-deposit-return-deadline", "Landlord will return the security deposit within 45 days after move-out.", true],
    ["wi-deposit-return-deadline", "Landlord will return the security deposit within 21 days after move-out.", false],
    ["wi-deposit-return-deadline", "Landlord shall refund the deposit within thirty (30) days.", true],
    ["wi-deposit-normal-wear", "Landlord may deduct for normal wear and tear.", true],
    ["wi-automatic-deposit-deduction", "A $150 carpet cleaning fee will be deducted from the deposit.", true],
    ["wi-automatic-deposit-deduction", "Per the Nonstandard Rental Provisions, a carpet cleaning fee will be deducted from the deposit.", false],
    ["wi-retaliation", "If Tenant reports the unit to the building inspector, Landlord may terminate this lease.", true],
    ["wi-crime-victim-termination", "Landlord may terminate this lease if any crime occurs on the premises.", true],
  ];

  it.each(cases)("%s on %j -> %s", (ruleId, text, expected) => {
    expect(fires(ruleId, text)).toBe(expected);
  });

  it("does not fire anything on an ordinary clause", () => {
    const text = "Tenant shall pay rent of $850 on the first day of each month.";
    expect(WISCONSIN_RULES.filter((r) => r.detect(text))).toEqual([]);
  });
});

describe("runRules", () => {
  it("returns findings sorted by severity with sentence-level evidence", () => {
    const clauses = segmentClauses(
      normalizeText(`1. DEPOSIT. Deposit is $800. Landlord will return the deposit within 60 days. Thanks.
2. DEFAULT. Tenant agrees to pay Landlord's attorney fees in any dispute.`),
    );
    const findings = runRules(clauses);
    expect(findings.map((f) => f.ruleId)).toEqual([
      "wi-attorney-fees",
      "wi-deposit-return-deadline",
    ]);
    expect(findings[1].evidence).toBe(
      "Landlord will return the deposit within 60 days.",
    );
    expect(findings[1].clauseId).toBe("c1");
  });
});

describe("scoreFindings", () => {
  it("is 100/A with no findings", () => {
    expect(scoreFindings([])).toMatchObject({ value: 100, grade: "A" });
  });

  it("penalizes each rule once", () => {
    const clauses = segmentClauses(
      normalizeText(`1. A. Tenant authorizes Landlord to confess judgment.
2. B. Tenant again agrees to a confession of judgment.`),
    );
    const score = scoreFindings(runRules(clauses));
    expect(score.counts.void).toBe(2);
    expect(score.value).toBe(75);
    expect(score.grade).toBe("B");
  });
});

describe("sentenceAround", () => {
  it("expands a match to its sentence", () => {
    expect(sentenceAround("First. The match is here. Last.", "match")).toBe(
      "The match is here.",
    );
  });
});
