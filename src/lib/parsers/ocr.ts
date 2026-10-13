/**
 * Optional OCR for images and scanned PDFs.
 *
 * Lattice does NOT ship an OCR engine by default — doing so would bloat the
 * install and contradict the $0/minimal-footprint goal. Instead we detect
 * whether a suitable engine is available at runtime and are explicit with the
 * user when it is not.
 *
 * To enable OCR: `npm install tesseract.js`
 * To enable scanned-PDF OCR: `npm install tesseract.js` and pass page images
 * through the same helper.
 */

import type { ParsedDocument } from "../types";

export const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "webp", "bmp", "tif", "tiff"]);

interface OcrAvailability {
  available: boolean;
  engine?: string;
  reason?: string;
}

let cached: OcrAvailability | null = null;

export async function ocrAvailability(): Promise<OcrAvailability> {
  if (cached) return cached;
  try {
    const dynamicImport = new Function("m", "return import(m)") as (m: string) => Promise<unknown>;
    await dynamicImport("tesseract.js");
    cached = { available: true, engine: "tesseract.js" };
  } catch {
    cached = {
      available: false,
      reason:
        "No OCR engine is installed. Image and scanned-PDF text extraction is disabled. Install tesseract.js to enable it.",
    };
  }
  return cached;
}

export async function parseImage(buffer: Buffer, filename: string): Promise<ParsedDocument> {
  const availability = await ocrAvailability();
  if (!availability.available) {
    return {
      documentTitle: filename.replace(/\.[^.]+$/, ""),
      documentType: "image",
      extractedText: "",
      headings: [],
      tables: [],
      metadata: {},
      warnings: [availability.reason ?? "OCR unavailable."],
    };
  }

  try {
    const dynamicImport = new Function("m", "return import(m)") as (m: string) => Promise<unknown>;
    const mod = (await dynamicImport("tesseract.js")) as {
      recognize: (
        image: Buffer,
        lang?: string,
      ) => Promise<{ data: { text: string } }>;
    };
    const { data } = await mod.recognize(buffer, "eng");
    return {
      documentTitle: filename.replace(/\.[^.]+$/, ""),
      documentType: "image",
      extractedText: data.text ?? "",
      headings: [],
      tables: [],
      metadata: { ocr: "tesseract.js" },
      warnings: [],
    };
  } catch (err) {
    return {
      documentTitle: filename.replace(/\.[^.]+$/, ""),
      documentType: "image",
      extractedText: "",
      headings: [],
      tables: [],
      metadata: {},
      warnings: [`OCR failed: ${(err as Error).message}`],
    };
  }
}
