import type { Rule } from "../types";

/**
 * Rule catalog for Wisconsin residential leases.
 *
 * Every rule is tied to a specific statute so findings are explainable and
 * checkable. Sources:
 *   - Wis. Stat. § 704.44 — provisions that make a residential rental
 *     agreement void and unenforceable.
 *   - Wis. Stat. § 704.28 — security deposit withholding and return.
 *
 * Detectors are deliberately conservative regexes: a missed clause is better
 * than a confident false alarm. The optional AI pass (see ../ai/review.ts)
 * catches paraphrased versions these patterns miss.
 *
 * This is informational tooling, not legal advice.
 */

const S704_44 = "https://docs.legis.wisconsin.gov/statutes/statutes/704/44";
const S704_28 = "https://docs.legis.wisconsin.gov/statutes/statutes/704/28";

/** Return the first regex match in `text`, unless an exclusion also matches. */
function firstMatch(
  text: string,
  patterns: RegExp[],
  exclude: RegExp[] = [],
): string | null {
  if (exclude.some((re) => re.test(text))) return null;
  for (const re of patterns) {
    const m = re.exec(text);
    if (m) return m[0];
  }
  return null;
}

const WORD_NUMBERS: Record<string, number> = {
  thirty: 30,
  "thirty-one": 31,
  forty: 40,
  "forty-five": 45,
  sixty: 60,
  ninety: 90,
};

/** Parse "45" or "forty-five" into a number. */
function parseDays(raw: string): number | null {
  const n = Number.parseInt(raw, 10);
  if (!Number.isNaN(n)) return n;
  return WORD_NUMBERS[raw.toLowerCase()] ?? null;
}

const TENANT = "(?:tenant|tenants|resident|residents|lessee|lessees)";
const LANDLORD = "(?:landlord|lessor|owner|management|manager|agent)";

export const WISCONSIN_RULES: Rule[] = [
  {
    id: "wi-retaliation",
    title: "Penalizes the tenant for contacting authorities",
    severity: "void",
    citation: { code: "Wis. Stat. § 704.44(1m)", url: S704_44 },
    explanation:
      "A lease can't let the landlord raise rent, cut services, evict, or refuse to renew because you contacted police, a building inspector, or a health or safety agency. Under § 704.44 a clause like this makes the whole lease void and unenforceable.",
    tenantAction:
      "Ask for the clause to be removed before signing. If the landlord refuses, contact Tenant Resource Center or local legal aid.",
    detect: (t) =>
      firstMatch(t, [
        new RegExp(
          `(?:contact|contacts|contacting|report|reports|reporting|call|calls|calling)[^.]{0,80}(?:police|law enforcement|building inspector|inspector|health department|fire department|authorities|government agency)[^.]{0,120}(?:terminat|evict|increase|raise|not renew|non-renewal|decrease)`,
          "i",
        ),
      ]),
  },
  {
    id: "wi-self-help-eviction",
    title: "Allows eviction without going to court",
    severity: "void",
    citation: { code: "Wis. Stat. § 704.44(2m)", url: S704_44 },
    explanation:
      "In Wisconsin a landlord can only remove a tenant through a court eviction. A clause allowing lockouts, removing your belongings, or shutting off utilities to force you out makes the lease void under § 704.44.",
    tenantAction:
      "Do not sign a lease with this clause as written. If a landlord ever locks you out, call local police and legal aid immediately.",
    detect: (t) =>
      firstMatch(t, [
        /(?:change|changing|re-?key|rekey)\s+(?:the\s+)?locks/i,
        /remove[^.]{0,40}(?:tenant'?s?|resident'?s?|your)?\s*(?:personal\s+)?(?:property|belongings|possessions)[^.]{0,60}(?:without|from the premises)/i,
        /(?:shut|turn|cut)\s*(?:off|-off)[^.]{0,40}(?:utilities|electric|electricity|heat|water|gas)/i,
        /(?:re-?enter|retake possession)[^.]{0,80}without[^.]{0,30}(?:court|judicial|legal process|notice)/i,
      ]),
  },
  {
    id: "wi-rent-acceleration",
    title: "Makes all remaining rent due at once / waives duty to re-rent",
    severity: "void",
    citation: { code: "Wis. Stat. § 704.44(3m)", url: S704_44 },
    explanation:
      "A lease can't make all future rent due at once if you break the lease, and it can't excuse the landlord from trying to re-rent the unit to reduce what you owe (the duty to mitigate under § 704.29). Either one makes the lease void under § 704.44.",
    tenantAction:
      "Strike the clause. If you need to leave early, the landlord must make reasonable efforts to re-rent, and you owe only the actual losses.",
    detect: (t) =>
      firstMatch(t, [
        /accelerat(?:e|ed|ion)[^.]{0,40}rent/i,
        /rent[^.]{0,30}accelerat/i,
        /(?:all|entire|remaining|balance of(?: the)?)\s+(?:remaining\s+)?rent[^.]{0,100}(?:immediately|at once)\s+(?:become\s+)?(?:due|payable)/i,
        /(?:waive|waives|waiver of)[^.]{0,60}(?:mitigat|duty to re-?rent)/i,
        new RegExp(
          `${LANDLORD}[^.]{0,40}(?:shall|will|is)\\s+(?:not|under no)\\s+(?:be\\s+)?(?:obligat|requir|duty)[^.]{0,40}(?:re-?rent|re-?let|mitigat)`,
          "i",
        ),
      ]),
  },
  {
    id: "wi-attorney-fees",
    title: "Makes the tenant pay the landlord's attorney fees",
    severity: "void",
    citation: { code: "Wis. Stat. § 704.44(4m)", url: S704_44 },
    explanation:
      "A lease can't require you to pay the landlord's attorney fees or legal costs from a dispute over the lease. (A judge can still award court costs under ch. 799 or 814; the lease itself can't.) Under § 704.44 this makes the lease void.",
    tenantAction:
      "Ask for the clause to be deleted. A lease that keeps it may be unenforceable against you.",
    detect: (t) =>
      firstMatch(
        t,
        [
          new RegExp(
            `${TENANT}[^.]{0,80}(?:pay|responsible for|liable for|reimburse)[^.]{0,80}(?:attorney'?s?'?|legal|lawyer'?s?'?)\\s+(?:fees|costs|expenses)`,
            "i",
          ),
          new RegExp(
            `(?:attorney'?s?'?|legal)\\s+(?:fees|costs)[^.]{0,80}(?:paid|borne|charged)\\s+by\\s+(?:the\\s+)?${TENANT}`,
            "i",
          ),
        ],
        [/(?:awarded|ordered) by (?:the|a) court/i],
      ),
  },
  {
    id: "wi-confession-of-judgment",
    title: "Lets the landlord confess judgment against the tenant",
    severity: "void",
    citation: { code: "Wis. Stat. § 704.44(5m)", url: S704_44 },
    explanation:
      "A confession-of-judgment clause lets the landlord get a court judgment against you without you being able to defend yourself. Wisconsin bans it, and it makes the lease void under § 704.44.",
    tenantAction: "Do not sign until this clause is removed.",
    detect: (t) =>
      firstMatch(t, [
        /confess(?:ion of|es|ing)?\s+judg(?:e)?ment/i,
        /cognovit/i,
        /warrant of attorney/i,
      ]),
  },
  {
    id: "wi-negligence-waiver",
    title: "Excuses the landlord from liability for their own negligence",
    severity: "void",
    citation: { code: "Wis. Stat. § 704.44(6)", url: S704_44 },
    explanation:
      "A lease can't say the landlord isn't responsible for injuries or property damage caused by the landlord's own negligence. Under § 704.44 that makes the lease void.",
    tenantAction:
      "Strike the clause, and consider renter's insurance either way. It covers your belongings no matter who is at fault.",
    detect: (t) =>
      firstMatch(t, [
        new RegExp(
          `${LANDLORD}[^.]{0,60}(?:shall not|will not|is not|are not|not be|cannot be)\\s+(?:be\\s+)?(?:held\\s+)?(?:liable|responsible)[^.]{0,160}(?:injur|damage|loss|harm)`,
          "i",
        ),
        new RegExp(
          `${TENANT}[^.]{0,60}(?:waive|waives|release|releases)[^.]{0,80}(?:claims?|right to sue|liability)[^.]{0,80}${LANDLORD}`,
          "i",
        ),
        /including (?:the )?(?:landlord'?s|lessor'?s|owner'?s) (?:own )?negligence/i,
      ]),
  },
  {
    id: "wi-tenant-liable-beyond-control",
    title: "Makes the tenant liable for damage they didn't cause",
    severity: "void",
    citation: { code: "Wis. Stat. § 704.44(7)", url: S704_44 },
    explanation:
      "A lease can't make you responsible for injuries clearly beyond your control, or for damage caused by natural disasters or by people other than you and your guests. Under § 704.44 that makes the lease void.",
    tenantAction:
      "Ask that the clause be limited to damage caused by you or your guests.",
    detect: (t) =>
      firstMatch(t, [
        new RegExp(
          `${TENANT}[^.]{0,60}(?:responsible|liable)[^.]{0,100}(?:regardless of (?:cause|fault|who)|however caused|from any cause|whether or not caused by)`,
          "i",
        ),
        new RegExp(
          `(?:fire|flood|storm|tornado|act of god|acts of god|natural disaster)[^.]{0,100}${TENANT}[^.]{0,40}(?:shall|will|is|are)\\s+(?:be\\s+)?(?:responsible|liable)`,
          "i",
        ),
        new RegExp(
          `${TENANT}[^.]{0,40}(?:shall|will|is|are)\\s+(?:be\\s+)?(?:responsible|liable)[^.]{0,80}(?:fire|flood|storm|act of god|acts of god|natural disaster)`,
          "i",
        ),
      ]),
  },
  {
    id: "wi-habitability-waiver",
    title: "Waives the landlord's duty to keep the unit livable",
    severity: "void",
    citation: { code: "Wis. Stat. § 704.44(8)", url: S704_44 },
    explanation:
      "The landlord must hand over the unit fit to live in and keep it that way during your tenancy. A clause that waives that duty, or pushes all repairs onto you, makes the lease void under § 704.44.",
    tenantAction:
      "Strike the clause. Routine upkeep like replacing light bulbs is fine, but major repairs are the landlord's job.",
    detect: (t) =>
      firstMatch(
        t,
        [
          /(?:waive|waives|waiver of)[^.]{0,60}(?:habitab|warranty of|duty to repair|right to repairs?)/i,
          new RegExp(
            `${TENANT}[^.]{0,40}(?:responsible for|shall (?:make|perform|pay for)|will (?:make|perform|pay for))\\s+all\\s+repairs`,
            "i",
          ),
          /accepts? the (?:premises|unit|apartment)[^.]{0,30}\bas[- ]is\b/i,
          new RegExp(
            `${LANDLORD}[^.]{0,40}(?:has no|shall have no|is under no)\\s+(?:obligation|duty)[^.]{0,30}(?:repair|maintain)`,
            "i",
          ),
        ],
      ),
  },
  {
    id: "wi-crime-victim-termination",
    title: "Allows ending the tenancy over any crime on the property",
    severity: "high",
    citation: { code: "Wis. Stat. § 704.44(9)–(10)", url: S704_44 },
    explanation:
      "A lease can't let the landlord end your tenancy just because of a crime on the property where you (or someone living with you) were the victim. A crime-based termination clause is also void unless the lease includes the notice required by § 704.14. Broad 'any crime' wording is a red flag.",
    tenantAction:
      "Ask for wording that excludes tenants who are crime victims, and check that the lease includes the § 704.14 domestic-abuse notice.",
    detect: (t) =>
      firstMatch(
        t,
        [
          /terminat[^.]{0,80}(?:any|a)\s+(?:crime|criminal activity)[^.]{0,80}(?:premises|property|unit)/i,
          /(?:any|a)\s+(?:crime|criminal activity)[^.]{0,60}(?:on|at|near)\s+the\s+(?:premises|property)[^.]{0,80}terminat/i,
        ],
        [/victim/i],
      ),
  },
  {
    id: "wi-deposit-return-deadline",
    title: "Gives the landlord more than 21 days to return the deposit",
    severity: "high",
    citation: { code: "Wis. Stat. § 704.28(4)", url: S704_28 },
    explanation:
      "Wisconsin landlords must return your security deposit, minus any lawful deductions, within 21 days after the tenancy ends. A lease can't extend that deadline.",
    tenantAction:
      "Point to § 704.28(4). The 21-day deadline applies no matter what the lease says.",
    detect: (t) => {
      const re =
        /(?:return|refund|mail|deliver)[^.]{0,80}(?:security\s+)?deposit[^.]{0,80}within\s+(\d+|thirty-one|thirty|forty-five|forty|sixty|ninety)\s*(?:\(\d+\)\s*)?days/i;
      const m = re.exec(t);
      if (!m) return null;
      const days = parseDays(m[1]);
      return days !== null && days > 21 ? m[0] : null;
    },
  },
  {
    id: "wi-deposit-normal-wear",
    title: "Deducts normal wear and tear from the deposit",
    severity: "high",
    citation: { code: "Wis. Stat. § 704.28(3)", url: S704_28 },
    explanation:
      "A landlord can't take money out of your deposit for normal wear and tear: faded paint, minor scuffs, carpet worn from ordinary use.",
    tenantAction:
      "Take dated photos at move-in and move-out. Dispute any deduction for ordinary wear in writing.",
    detect: (t) =>
      firstMatch(t, [
        /(?:deduct|withhold|charge)[^.]{0,80}(?:normal|ordinary|reasonable)\s+wear\s+and\s+tear/i,
        /(?:normal|ordinary)\s+wear\s+and\s+tear[^.]{0,60}(?:will|shall|may)\s+be\s+(?:deducted|charged|withheld)/i,
      ]),
  },
  {
    id: "wi-automatic-deposit-deduction",
    title: "Automatic deposit deduction (cleaning, painting, carpet, fees)",
    severity: "review",
    citation: { code: "Wis. Stat. § 704.28(1)–(2)", url: S704_28 },
    explanation:
      "A deduction that isn't for damage, unpaid rent, or utilities is only allowed if it appears in a separate document titled 'NONSTANDARD RENTAL PROVISIONS' that the landlord pointed out to you before you signed. Automatic carpet-cleaning or repainting charges often fail that test.",
    tenantAction:
      "Ask whether this charge is in a signed Nonstandard Rental Provisions document. If it isn't, it may not be deductible.",
    detect: (t) =>
      firstMatch(
        t,
        [
          /(?:deduct|withhold|charge)[^.]{0,80}(?:carpet[- ]clean|professional(?:ly)? clean|clean(?:ing)? fee|repaint|painting|re-?keying|administrative fee)/i,
          /(?:carpet[- ]clean|cleaning fee|repaint)[^.]{0,80}(?:deducted|withheld)\s+(?:from|out of)[^.]{0,30}deposit/i,
          /non-?refundable[^.]{0,40}(?:deposit|portion of (?:the )?deposit)/i,
        ],
        [/nonstandard rental provision/i],
      ),
  },
];

/** Look up a rule by id. */
export function getRule(id: string): Rule | undefined {
  return WISCONSIN_RULES.find((r) => r.id === id);
}
