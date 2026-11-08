import { extractText, getDocumentProxy } from "unpdf";

export const MAX_PDF_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_PAGES = 60;

export class ExtractionError extends Error {
  constructor(
    message: string,
    readonly code: "too_large" | "too_many_pages" | "scanned" | "unreadable",
  ) {
    super(message);
    this.name = "ExtractionError";
  }
}

/** Check the magic bytes rather than trusting the file extension. */
export function isPdf(bytes: Uint8Array): boolean {
  return (
    bytes.length > 4 &&
    bytes[0] === 0x25 && // %
    bytes[1] === 0x50 && // P
    bytes[2] === 0x44 && // D
    bytes[3] === 0x46 // F
  );
}

/**
 * Extract text from a PDF lease, one page at a time, joined with blank lines
 * so the segmenter sees page breaks as paragraph breaks.
 */
export async function extractPdfText(
  bytes: Uint8Array,
): Promise<{ text: string; pageCount: number }> {
  if (bytes.byteLength > MAX_PDF_BYTES) {
    throw new ExtractionError("PDF is larger than 10 MB.", "too_large");
  }
  if (!isPdf(bytes)) {
    throw new ExtractionError("That file isn't a valid PDF.", "unreadable");
  }

  let pages: string[];
  let pageCount: number;
  try {
    const pdf = await getDocumentProxy(bytes);
    const result = await extractText(pdf, { mergePages: false });
    pages = result.text;
    pageCount = result.totalPages;
  } catch {
    throw new ExtractionError(
      "Couldn't read that PDF. It may be encrypted or corrupted.",
      "unreadable",
    );
  }

  if (pageCount > MAX_PAGES) {
    throw new ExtractionError(
      `PDF has ${pageCount} pages; the limit is ${MAX_PAGES}.`,
      "too_many_pages",
    );
  }

  const text = pages.map((p) => p.trim()).join("\n\n");
  // A scanned lease is just page images; it yields almost no text per page.
  const charsPerPage = text.replace(/\s/g, "").length / Math.max(pageCount, 1);
  if (charsPerPage < 50) {
    throw new ExtractionError(
      "This PDF looks scanned (no selectable text). Paste the lease text instead.",
      "scanned",
    );
  }

  return { text, pageCount };
}
