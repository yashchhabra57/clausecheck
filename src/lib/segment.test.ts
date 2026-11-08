import { describe, expect, it } from "vitest";
import { normalizeText, segmentClauses } from "./segment";

describe("normalizeText", () => {
  it("re-joins words hyphenated across lines", () => {
    expect(normalizeText("security de-\nposit")).toBe("security deposit");
  });

  it("collapses whitespace and blank lines", () => {
    expect(normalizeText("a  \t b\r\n\r\n\r\n\r\nc")).toBe("a b\n\nc");
  });

  it("straightens smart quotes", () => {
    expect(normalizeText("Tenant’s “key”")).toBe(`Tenant's "key"`);
  });
});

describe("segmentClauses", () => {
  it("splits on numbered sections and keeps titles", () => {
    const text = normalizeText(`RESIDENTIAL LEASE AGREEMENT
This lease is made between Landlord and Tenant.
1. RENT. Tenant shall pay $900 per month
on the first day of each month.
2. SECURITY DEPOSIT. Tenant shall pay a deposit of $900.
3. PETS. No pets are allowed.`);
    const clauses = segmentClauses(text);
    expect(clauses).toHaveLength(4);
    expect(clauses[1].heading).toBe("1. RENT");
    expect(clauses[1].text).toBe(
      "1. RENT. Tenant shall pay $900 per month on the first day of each month.",
    );
    expect(clauses[2].heading).toBe("2. SECURITY DEPOSIT");
    expect(clauses.map((c) => c.id)).toEqual(["c1", "c2", "c3", "c4"]);
  });

  it("merges a lone caps heading into the following clause", () => {
    const text = normalizeText(`LATE FEES
Section 4. A late fee of $50 applies after the 5th.
Section 5. Tenant may not sublet.`);
    const clauses = segmentClauses(text);
    expect(clauses).toHaveLength(2);
    expect(clauses[0].heading).toBe("LATE FEES");
    expect(clauses[0].text).toContain("A late fee of $50");
  });

  it("keeps a document title separate from section 1", () => {
    const text = normalizeText(`RESIDENTIAL LEASE
1. RENT. Tenant shall pay $900 per month.
2. DEPOSIT. The deposit is $900.`);
    const clauses = segmentClauses(text);
    expect(clauses.map((c) => c.heading)).toEqual([
      "RESIDENTIAL LEASE",
      "1. RENT",
      "2. DEPOSIT",
    ]);
  });

  it("falls back to paragraphs when there are no headings", () => {
    const text = normalizeText(
      "Tenant pays rent monthly.\n\nLandlord handles repairs.\n\nNo smoking indoors.",
    );
    const clauses = segmentClauses(text);
    expect(clauses.map((c) => c.text)).toEqual([
      "Tenant pays rent monthly.",
      "Landlord handles repairs.",
      "No smoking indoors.",
    ]);
    expect(clauses.every((c) => c.heading === null)).toBe(true);
  });

  it("tracks character offsets into the normalized text", () => {
    const text = normalizeText("1. First clause here.\n2. Second clause here.");
    const [, second] = segmentClauses(text);
    expect(text.slice(second.start, second.end)).toBe("2. Second clause here.");
  });
});
