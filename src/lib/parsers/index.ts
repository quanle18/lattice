/**
 * Parser registry + secure dispatch.
 *
 * Uploaded files are untrusted input. We validate extension, declared MIME and
 * magic bytes before handing bytes to a parser, and we never execute content.
 */

import type { ParsedDocument } from "../types";
import { parseHtml } from "./html";
import { IMAGE_EXTENSIONS, ocrAvailability, parseImage } from "./ocr";
import { parseDocx, parsePptx } from "./office";
import { parsePdf } from "./pdf";
import { parseCsv, parseJson, parseXml } from "./tabular";
import { isTextExtension, parseText } from "./text";

export interface FormatInfo {
  ext: string;
  label: string;
  kind: "document" | "tabular" | "structured" | "image" | "text";
  priority: 1 | 2 | 3;
  /** Whether the parser works out of the box (no optional dependency). */
  builtIn: boolean;
}

export const SUPPORTED_FORMATS: FormatInfo[] = [
  { ext: "pdf", label: "PDF", kind: "document", priority: 1, builtIn: true },
  { ext: "docx", label: "Word (.docx)", kind: "document", priority: 1, builtIn: true },
  { ext: "pptx", label: "PowerPoint (.pptx)", kind: "document", priority: 1, builtIn: true },
  { ext: "txt", label: "Plain text", kind: "text", priority: 1, builtIn: true },
  { ext: "md", label: "Markdown", kind: "text", priority: 1, builtIn: true },
  { ext: "csv", label: "CSV", kind: "tabular", priority: 1, builtIn: true },
  { ext: "html", label: "HTML", kind: "document", priority: 2, builtIn: true },
  { ext: "htm", label: "HTML", kind: "document", priority: 2, builtIn: true },
  { ext: "json", label: "JSON", kind: "structured", priority: 2, builtIn: true },
  { ext: "xml", label: "XML", kind: "structured", priority: 2, builtIn: true },
  { ext: "rtf", label: "Rich Text (.rtf)", kind: "text", priority: 2, builtIn: true },
  { ext: "png", label: "Image (OCR)", kind: "image", priority: 3, builtIn: false },
  { ext: "jpg", label: "Image (OCR)", kind: "image", priority: 3, builtIn: false },
  { ext: "jpeg", label: "Image (OCR)", kind: "image", priority: 3, builtIn: false },
  { ext: "webp", label: "Image (OCR)", kind: "image", priority: 3, builtIn: false },
];

export const ACCEPTED_EXTENSIONS = SUPPORTED_FORMATS.map((f) => f.ext);

export function extensionOf(filename: string): string {
  const m = /\.([a-z0-9]+)$/i.exec(filename.trim());
  return m ? m[1].toLowerCase() : "";
}

export class UnsupportedFormatError extends Error {
  constructor(public ext: string) {
    super(
      ext
        ? `Unsupported file type ".${ext}". Supported: ${ACCEPTED_EXTENSIONS.join(", ")}.`
        : `The file has no extension. Supported: ${ACCEPTED_EXTENSIONS.join(", ")}.`,
    );
    this.name = "UnsupportedFormatError";
  }
}

export class FileValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FileValidationError";
  }
}

/** Magic-byte sniffing. Returns a coarse family, or "unknown". */
export function sniffBytes(buffer: Buffer): "pdf" | "zip" | "png" | "jpeg" | "gif" | "webp" | "text" | "unknown" {
  if (buffer.length >= 4 && buffer.subarray(0, 4).toString("latin1") === "%PDF") return "pdf";
  if (buffer.length >= 2 && buffer[0] === 0x50 && buffer[1] === 0x4b) return "zip"; // docx/pptx/xlsx
  if (buffer.length >= 8 && buffer.subarray(0, 8).toString("hex") === "89504e470d0a1a0a") return "png";
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "jpeg";
  if (buffer.length >= 4 && buffer.subarray(0, 4).toString("latin1") === "GIF8") return "gif";
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString("latin1") === "RIFF" && buffer.subarray(8, 12).toString("latin1") === "WEBP") return "webp";
  // Printable-ASCII ratio heuristic for text-like files.
  const sample = buffer.subarray(0, Math.min(buffer.length, 2048));
  let printable = 0;
  for (const b of sample) if (b === 9 || b === 10 || b === 13 || (b >= 32 && b < 127) || b >= 160) printable++;
  if (sample.length > 0 && printable / sample.length > 0.9) return "text";
  return "unknown";
}

export interface ParseOptions {
  maxBytes?: number;
}

export async function parseDocument(
  buffer: Buffer,
  filename: string,
  declaredMime?: string,
  opts: ParseOptions = {},
): Promise<ParsedDocument> {
  const ext = extensionOf(filename);
  const format = SUPPORTED_FORMATS.find((f) => f.ext === ext);
  if (!format) throw new UnsupportedFormatError(ext);

  if (opts.maxBytes && buffer.length > opts.maxBytes) {
    throw new FileValidationError(
      `File exceeds the ${(opts.maxBytes / 1024 / 1024).toFixed(0)} MB limit.`,
    );
  }
  if (buffer.length === 0) throw new FileValidationError("The file is empty.");

  // Magic-byte cross-check for the formats where a mismatch is meaningful.
  const family = sniffBytes(buffer);
  const expectZip = ext === "docx" || ext === "pptx";
  const expectPdf = ext === "pdf";
  const expectImage = IMAGE_EXTENSIONS.has(ext);
  if (expectPdf && family !== "pdf") {
    throw new FileValidationError("This file is named .pdf but is not a valid PDF.");
  }
  if (expectZip && family !== "zip") {
    throw new FileValidationError(`This file is named .${ext} but is not a valid Office (ZIP) container.`);
  }
  if (expectImage && !["png", "jpeg", "gif", "webp"].includes(family)) {
    throw new FileValidationError(`This file is named .${ext} but does not look like an image.`);
  }
  if (declaredMime && declaredMime.includes("html") && ext === "txt") {
    // A .txt file that is actually HTML: route it through the HTML parser.
    return parseHtml(buffer.toString("utf8"), filename);
  }

  switch (ext) {
    case "pdf":
      return parsePdf(buffer, filename);
    case "docx":
      return parseDocx(buffer, filename);
    case "pptx":
      return parsePptx(buffer, filename);
    case "csv":
      return parseCsv(buffer, filename);
    case "json":
      return parseJson(buffer, filename);
    case "xml":
      return parseXml(buffer, filename);
    case "html":
    case "htm":
      return parseHtml(buffer.toString("utf8"), filename);
    default:
      if (isTextExtension(ext)) return parseText(buffer, filename, ext);
      if (IMAGE_EXTENSIONS.has(ext)) return parseImage(buffer, filename);
      throw new UnsupportedFormatError(ext);
  }
}

/** Human-readable capability report for the UI. */
export async function formatCapabilities(): Promise<Array<FormatInfo & { enabled: boolean; note?: string }>> {
  const ocr = await ocrAvailability();
  return SUPPORTED_FORMATS.map((f) => ({
    ...f,
    enabled: f.builtIn || (f.kind === "image" && ocr.available),
    note: f.kind === "image" && !ocr.available ? "Requires optional tesseract.js" : undefined,
  }));
}
