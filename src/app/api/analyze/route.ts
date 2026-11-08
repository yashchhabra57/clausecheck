import { analyzeLease, InputError } from "@/lib/analyze";
import { ExtractionError, extractPdfText, MAX_PDF_BYTES } from "@/lib/pdf";

export const runtime = "nodejs";
export const maxDuration = 120;

function error(status: number, message: string) {
  return Response.json({ error: message }, { status });
}

/**
 * POST /api/analyze
 *
 * Accepts either:
 *   - multipart/form-data with a `file` field (PDF or .txt), or
 *   - application/json `{ "text": "...", "useAi": true }`
 */
export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";

  let text: string;
  let pageCount: number | null = null;
  let useAi = true;

  try {
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      useAi = form.get("useAi") !== "false";
      if (!(file instanceof File)) return error(400, "Attach a PDF or .txt file.");
      if (file.size > MAX_PDF_BYTES) return error(413, "File is larger than 10 MB.");

      const bytes = new Uint8Array(await file.arrayBuffer());
      if (file.type === "text/plain" || file.name.toLowerCase().endsWith(".txt")) {
        text = new TextDecoder().decode(bytes);
      } else {
        const extracted = await extractPdfText(bytes);
        text = extracted.text;
        pageCount = extracted.pageCount;
      }
    } else if (contentType.includes("application/json")) {
      const body = (await request.json().catch(() => null)) as
        | { text?: unknown; useAi?: unknown }
        | null;
      if (!body || typeof body.text !== "string") {
        return error(400, 'Send JSON like { "text": "..." }.');
      }
      text = body.text;
      useAi = body.useAi !== false;
    } else {
      return error(415, "Use multipart/form-data or application/json.");
    }

    const result = await analyzeLease(text, { useAi, pageCount });
    return Response.json(result);
  } catch (err) {
    if (err instanceof ExtractionError) {
      return error(err.code === "too_large" ? 413 : 422, err.message);
    }
    if (err instanceof InputError) return error(422, err.message);
    console.error("analyze failed", err);
    return error(500, "Something went wrong while analyzing the lease.");
  }
}
