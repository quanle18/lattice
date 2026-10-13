/**
 * Plain-text, Markdown and RTF parsing.
 * Server-side only (imports node:buffer for byte decoding).
 */

import type { ParsedDocument } from "../types";

const TEXT_EXTENSIONS = new Set(["txt", "text", "log", "md", "markdown", "mdx", "rtf"]);

export function isTextExtension(ext: string): boolean {
  return TEXT_EXTENSIONS.has(ext.toLowerCase());
}

function decode(buffer: Buffer): string {
  const utf8 = buffer.toString("utf8");
  // Heuristic: if the UTF-8 decode produced many replacement characters,
  // fall back to latin-1 so we never return mojibake silently.
  const replacements = (utf8.match(/\uFFFD/g) || []).length;
  if (replacements > utf8.length * 0.01) return buffer.toString("latin1");
  return utf8.replace(/^\uFEFF/, "");
}

export function parseText(buffer: Buffer, filename: string, ext: string): ParsedDocument {
  const raw = decode(buffer);
  if (ext === "rtf") return parseRtf(raw, filename);
  if (ext === "md" || ext === "markdown" || ext === "mdx") return parseMarkdown(raw, filename);
  return {
    documentTitle: filename.replace(/\.[^.]+$/, ""),
    documentType: "text",
    extractedText: raw,
    headings: [],
    tables: [],
    metadata: { encoding: "utf-8" },
    warnings: [],
  };
}

export function parseMarkdown(raw: string, filename: string): ParsedDocument {
  const headings: string[] = [];
  for (const line of raw.split("\n")) {
    const m = /^(#{1,6})\s+(.*)$/.exec(line.trim());
    if (m) headings.push(m[2].trim());
  }
  // Strip fenced code blocks from the analysis text but keep inline content.
  const text = raw.replace(/```[\s\S]*?```/g, " ");
  return {
    documentTitle: headings[0] ?? filename.replace(/\.[^.]+$/, ""),
    documentType: "markdown",
    extractedText: text,
    headings,
    tables: [],
    metadata: { headingCount: headings.length },
    warnings: [],
  };
}

/**
 * Minimal, safe RTF text extractor. Handles the common control words,
 * unicode escapes (\uN?) and hex escapes (\'hh). It never executes anything.
 */
export function parseRtf(raw: string, filename: string): ParsedDocument {
  let text = raw.replace(/\\'([0-9a-fA-F]{2})/g, (_m, h) => String.fromCharCode(parseInt(h, 16)));
  text = text.replace(/\\u(-?\d+)\??/g, (_m, n) => {
    const code = Number(n);
    return String.fromCharCode(code < 0 ? code + 65536 : code);
  });
  text = text
    .replace(/\{\\\*[\s\S]*?\}/g, " ") // ignorable destinations
    .replace(/\\par[d]?\b/g, "\n")
    .replace(/\\line\b/g, "\n")
    .replace(/\\tab\b/g, "\t")
    .replace(/\\[a-zA-Z]+-?\d* ?/g, "")
    .replace(/[{}]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return {
    documentTitle: filename.replace(/\.[^.]+$/, ""),
    documentType: "rtf",
    extractedText: text,
    headings: [],
    tables: [],
    metadata: {},
    warnings: [],
  };
}
