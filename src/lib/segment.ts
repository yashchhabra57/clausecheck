import type { Clause } from "./types";

/**
 * Clean up text that came out of a PDF or a paste:
 * - unify line endings
 * - re-join words hyphenated across a line break ("secu-\nrity" -> "security")
 * - collapse runs of spaces/tabs and excessive blank lines
 */
export function normalizeText(raw: string): string {
  return raw
    .replace(/\r\n?/g, "\n")
    .replace(/[   ]/g, " ")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/(\w)-\n(\w)/g, "$1$2")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** "Section 4", "ARTICLE IV", "Clause 2:" */
const NAMED_HEADING = /^(?:section|article|clause|paragraph)\s+[\dIVXLC]+[.:)]?(?:\s|$)/i;
/** "1. ", "12) ", "3.1 ", "4.2.1 " */
const NUMBERED_HEADING = /^\d{1,2}(?:\.\d{1,2})*[.)]?\s+(?=[A-Za-z"(])/;
/** A short line in ALL CAPS, e.g. "SECURITY DEPOSIT" */
const CAPS_HEADING = /^[A-Z][A-Z0-9 &/,'()-]{2,60}[.:]?$/;

function isHeadingLine(line: string): boolean {
  if (NAMED_HEADING.test(line)) return true;
  if (NUMBERED_HEADING.test(line)) return true;
  // Require at least one letter run of 3+ so "I." or "A B" don't count.
  return CAPS_HEADING.test(line) && /[A-Z]{3,}/.test(line);
}

/** A line that is only a heading with no clause body, e.g. "RENT" or "Section 4." */
function isHeadingOnly(line: string): boolean {
  if (CAPS_HEADING.test(line) && /[A-Z]{3,}/.test(line)) return true;
  return /^(?:(?:section|article|clause|paragraph)\s+[\dIVXLC]+|\d{1,2}(?:\.\d{1,2})*)[.:)]?$/i.test(
    line,
  );
}

/** Pull a short title out of the first line of a clause. */
function extractHeading(firstLine: string): string | null {
  if (CAPS_HEADING.test(firstLine) && /[A-Z]{3,}/.test(firstLine)) {
    return firstLine.replace(/[.:]$/, "");
  }
  const m =
    /^((?:(?:section|article|clause|paragraph)\s+[\dIVXLC]+|\d{1,2}(?:\.\d{1,2})*)[.:)]?)\s*([^.:]{0,60}?)(?:[.:]|$)/i.exec(
      firstLine,
    );
  if (!m) return null;
  const label = m[1].replace(/[.:)]$/, "");
  const title = m[2].trim();
  // Only keep the title if it looks like one (short, mostly capitalized words).
  const looksLikeTitle =
    title.length > 0 &&
    title.split(/\s+/).length <= 6 &&
    /^[A-Z"(]/.test(title);
  return looksLikeTitle ? `${label}. ${title}` : label;
}

interface Block {
  start: number;
  end: number;
  lines: string[];
}

function collapse(lines: string[]): string {
  return lines.join(" ").replace(/\s+/g, " ").trim();
}

/**
 * Split a normalized lease into clauses.
 *
 * Strategy: start a new clause at every heading-like line (numbered sections,
 * "Section N", or short ALL-CAPS lines). If the document has almost no
 * headings, fall back to splitting on blank lines. Heading-only fragments are
 * merged into the clause that follows them.
 */
export function segmentClauses(text: string): Clause[] {
  const lines: { text: string; start: number }[] = [];
  let offset = 0;
  for (const line of text.split("\n")) {
    lines.push({ text: line, start: offset });
    offset += line.length + 1;
  }

  const headingCount = lines.filter((l) => l.text && isHeadingLine(l.text)).length;
  const useHeadings = headingCount >= 2;

  const blocks: Block[] = [];
  let current: Block | null = null;

  for (const line of lines) {
    const boundary = useHeadings
      ? line.text !== "" && isHeadingLine(line.text)
      : line.text === "";

    if (boundary || !current) {
      if (current && current.lines.length) blocks.push(current);
      current = { start: line.start, end: line.start, lines: [] };
    }
    if (line.text !== "") {
      current.lines.push(line.text);
      current.end = line.start + line.text.length;
    }
  }
  if (current && current.lines.length) blocks.push(current);

  // Merge heading-only fragments (e.g. a lone "RENT" line) into the next block.
  const merged: Block[] = [];
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    const next = blocks[i + 1];
    if (next && b.lines.length === 1 && isHeadingOnly(b.lines[0])) {
      next.lines.unshift(...b.lines);
      next.start = b.start;
      continue;
    }
    merged.push(b);
  }

  return merged.map((b, index) => ({
    id: `c${index + 1}`,
    index,
    heading: extractHeading(b.lines[0]),
    text: collapse(b.lines),
    start: b.start,
    end: b.end,
  }));
}
