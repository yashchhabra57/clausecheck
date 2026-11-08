import { describe, expect, it } from "vitest";
import { analyzeLease, InputError } from "./analyze";

const LEASE = `RESIDENTIAL LEASE
1. RENT. Tenant shall pay $950 per month, due on the first of each month.
2. SECURITY DEPOSIT. Tenant shall pay a $950 security deposit. Landlord will return the deposit within 30 days after Tenant vacates.
3. DEFAULT. Tenant authorizes Landlord to confess judgment against Tenant for any unpaid rent.
4. QUIET ENJOYMENT. Tenant may use the premises peacefully for residential purposes only.`;

describe("analyzeLease", () => {
  it("runs the rule pipeline end to end without AI", async () => {
    const result = await analyzeLease(LEASE, { useAi: false });
    // Title + 4 numbered sections.
    expect(result.clauses.length).toBe(5);
    expect(result.findings.map((f) => f.ruleId)).toEqual([
      "wi-confession-of-judgment",
      "wi-deposit-return-deadline",
    ]);
    expect(result.score).toMatchObject({ value: 63, grade: "C" });
    expect(result.meta).toMatchObject({ aiUsed: false, jurisdiction: "WI" });
  });

  it("rejects input that is too short", async () => {
    await expect(analyzeLease("hello", { useAi: false })).rejects.toBeInstanceOf(InputError);
  });
});
