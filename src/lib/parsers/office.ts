/**
 * Office document parsing: DOCX (mammoth) and PPTX (jszip + XML).
 *
 * Both are server-only. Uploaded files are treated as untrusted input: we
 * only read content, never evaluate it, and every step is wrapped so a
 * malformed file yields a clear warning instead of a crash.
 */

import JSZip from "jszip";
import mammoth from "mammoth";
import type { ParsedDocument } from "../types";
import { decodeEntities } from "./html";

// ── DOCX ─────────────────────────────────────────────────────────────────────

export async function parseDocx(buffer: Buffer, filename: string): Promise<ParsedDocument> {
  const warnings: string[] = [];
  let text = "";
  let headings: string[] = [];
  const tables: string[][][] = [];

  try {
    const result = await mammoth.extractRawText({ buffer });
    text = result.value ?? "";
    for (const m of result.messages ?? []) {
      if (m.type === "warning" || m.type === "error") warnings.push(String(m.message));
    }
  } catch (err) {
    warnings.push(`DOCX text extraction failed: ${(err as Error).message}`);
  }

  // Second pass for structure (headings + tables) via HTML conversion.
  try {
    const html = await mammoth.convertToHtml({ buffer });
    const h = html.value ?? "";
    for (const m of h.matchAll(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi)) {
      const t = decodeEntities(m[1].replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
      if (t) headings.push(t);
    }
    for (const tm of h.matchAll(/<table[\s\S]*?<\/table>/gi)) {
      const rows: string[][] = [];
      for (const rm of tm[0].matchAll(/<tr[\s\S]*?<\/tr>/gi)) {
        const cells: string[] = [];
        for (const cm of rm[0].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)) {
          cells.push(decodeEntities(cm[1].replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim());
        }
        if (cells.length) rows.push(cells);
      }
      if (rows.length) tables.push(rows);
    }
  } catch {
    /* structure pass is best-effort */
  }

  if (!text.trim()) {
    warnings.push("No text could be extracted from this DOCX file. It may be corrupt or contain only images.");
  }

  return {
    documentTitle: headings[0] ?? filename.replace(/\.[^.]+$/, ""),
    documentType: "docx",
    extractedText: text,
    headings,
    tables,
    metadata: { headingCount: headings.length, tableCount: tables.length },
    warnings,
  };
}

// ── PPTX ─────────────────────────────────────────────────────────────────────

function slideNumber(path: string): number {
  const m = /slide(\d+)\.xml$/.exec(path);
  return m ? Number(m[1]) : 0;
}

function extractSlideTexts(xml: string): string[] {
  const texts: string[] = [];
  for (const m of xml.matchAll(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g)) {
    const t = decodeEntities(m[1]).trim();
    if (t) texts.push(t);
  }
  return texts;
}

export async function parsePptx(buffer: Buffer, filename: string): Promise<ParsedDocument> {
  const warnings: string[] = [];
  const slideBodies: string[] = [];
  const headings: string[] = [];

  try {
    const zip = await JSZip.loadAsync(buffer);
    const slidePaths = Object.keys(zip.files)
      .filter((p) => /^ppt\/slides\/slide\d+\.xml$/.test(p))
      .sort((a, b) => slideNumber(a) - slideNumber(b));

    if (slidePaths.length === 0) {
      warnings.push("No slides were found inside this PPTX file.");
    }

    for (let i = 0; i < slidePaths.length; i++) {
      const xml = await zip.files[slidePaths[i]].async("string");
      const texts = extractSlideTexts(xml);
      if (texts.length === 0) continue;
      // The first text run on a slide is almost always the title.
      headings.push(texts[0]);
      slideBodies.push(`Slide ${i + 1}: ${texts.join(" — ")}`);
    }

    // Speaker notes carry a lot of signal; include them when present.
    const notePaths = Object.keys(zip.files)
      .filter((p) => /^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(p))
      .sort((a, b) => slideNumber(a) - slideNumber(b));
    for (const p of notePaths) {
      const xml = await zip.files[p].async("string");
      const texts = extractSlideTexts(xml);
      if (texts.length) slideBodies.push(`Notes: ${texts.join(" ")}`);
    }

    let title = headings[0] ?? filename.replace(/\.[^.]+$/, "");
    const core = zip.files["docProps/core.xml"];
    if (core) {
      const coreXml = await core.async("string");
      const t = /<dc:title[^>]*>([\s\S]*?)<\/dc:title>/.exec(coreXml)?.[1];
      if (t) title = decodeEntities(t).trim();
    }

    return {
      documentTitle: title,
      documentType: "pptx",
      extractedText: slideBodies.join("\n"),
      headings,
      tables: [],
      metadata: { slides: slidePaths.length, notes: notePaths.length },
      warnings,
    };
  } catch (err) {
    warnings.push(`PPTX extraction failed: ${(err as Error).message}`);
    return {
      documentTitle: filename.replace(/\.[^.]+$/, ""),
      documentType: "pptx",
      extractedText: "",
      headings: [],
      tables: [],
      metadata: {},
      warnings,
    };
  }
}
