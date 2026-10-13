/**
 * PDF parsing via pdf-parse (which wraps pdf.js). Text-layer extraction only.
 *
 * When a PDF has little or no text layer it is almost certainly scanned; we
 * say so explicitly and offer the OCR path rather than returning a silently
 * empty analysis.
 */

import pdfParse from "pdf-parse";
import type { ParsedDocument } from "../types";

export async function parsePdf(buffer: Buffer, filename: string): Promise<ParsedDocument> {
  const warnings: string[] = [];
  try {
    const result = await pdfParse(buffer);
    const text: string = result.text ?? "";
    const pages: number = result.numpages ?? 0;
    const info = (result.info ?? {}) as Record<string, unknown>;

    const charsPerPage = pages > 0 ? text.replace(/\s/g, "").length / pages : text.length;
    if (charsPerPage < 40) {
      warnings.push(
        pages > 0
          ? `This PDF has very little selectable text (${Math.round(charsPerPage)} characters per page), which usually means it is a scan. OCR is required to read it.`
          : "No text layer was found in this PDF. OCR is required to read it.",
      );
    }

    const title =
      typeof info.Title === "string" && info.Title.trim()
        ? info.Title.trim()
        : filename.replace(/\.[^.]+$/, "");

    return {
      documentTitle: title,
      documentType: "pdf",
      extractedText: text,
      headings: [],
      tables: [],
      metadata: {
        pageCount: pages,
        author: typeof info.Author === "string" ? info.Author : undefined,
        producer: typeof info.Producer === "string" ? info.Producer : undefined,
        creationDate: typeof info.CreationDate === "string" ? info.CreationDate : undefined,
      },
      pageCount: pages,
      warnings,
    };
  } catch (err) {
    return {
      documentTitle: filename.replace(/\.[^.]+$/, ""),
      documentType: "pdf",
      extractedText: "",
      headings: [],
      tables: [],
      metadata: {},
      warnings: [`PDF extraction failed: ${(err as Error).message}`],
    };
  }
}
