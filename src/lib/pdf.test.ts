import { describe, expect, it } from "vitest";
import { ExtractionError, extractPdfText, isPdf } from "./pdf";

describe("isPdf", () => {
  it("checks magic bytes", () => {
    expect(isPdf(new TextEncoder().encode("%PDF-1.7 ..."))).toBe(true);
    expect(isPdf(new TextEncoder().encode("hello world"))).toBe(false);
  });
});

/** Build a minimal one-page PDF with the given lines of text. */
function makePdf(lines: string[]): Uint8Array {
  const content = [
    "BT /F1 12 Tf 72 720 Td 14 TL",
    ...lines.map((l) => `(${l.replace(/[()\\]/g, "\\$&")}) Tj T*`),
    "ET",
  ].join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("");
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(pdf);
}

describe("extractPdfText", () => {
  it("extracts text from a real PDF", async () => {
    const pdf = makePdf([
      "1. RENT. Tenant shall pay $900 per month on the first of the month.",
      "2. DEPOSIT. Landlord will return the deposit within 45 days.",
    ]);
    const { text, pageCount } = await extractPdfText(pdf);
    expect(pageCount).toBe(1);
    expect(text).toContain("Tenant shall pay $900 per month");
    expect(text).toContain("within 45 days");
  });

  it("flags PDFs with almost no text as scanned", async () => {
    await expect(extractPdfText(makePdf(["x"]))).rejects.toMatchObject({
      code: "scanned",
    });
  });

  it("rejects non-PDF bytes", async () => {
    await expect(
      extractPdfText(new TextEncoder().encode("not a pdf at all")),
    ).rejects.toBeInstanceOf(ExtractionError);
  });

  it("rejects oversized files before parsing", async () => {
    const big = new Uint8Array(11 * 1024 * 1024);
    await expect(extractPdfText(big)).rejects.toMatchObject({ code: "too_large" });
  });
});
