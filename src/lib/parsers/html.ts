/**
 * HTML parsing. Extracts the title, headings and readable body text without
 * pulling in a DOM library. Deliberately conservative: strips script/style,
 * decodes the common entities, and preserves block structure as newlines.
 */

import type { ParsedDocument } from "../types";

const ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  ndash: "–", mdash: "—", hellip: "…", rsquo: "’", lsquo: "‘",
  rdquo: "”", ldquo: "“", copy: "©", reg: "®", trade: "™",
  eacute: "é", egrave: "è", agrave: "à", uuml: "ü", ouml: "ö",
  aacute: "á", iacute: "í", oacute: "ó", uacute: "ú", ntilde: "ñ",
};

export function decodeEntities(input: string): string {
  return input.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (m, code: string) => {
    if (code.startsWith("#x") || code.startsWith("#X")) {
      const n = parseInt(code.slice(2), 16);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    if (code.startsWith("#")) {
      const n = parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return ENTITIES[code.toLowerCase()] ?? m;
  });
}

function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<\/(p|div|section|article|li|tr|h[1-6]|blockquote|pre)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
}

export function parseHtml(raw: string, filename = "document.html"): ParsedDocument {
  const warnings: string[] = [];
  const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(raw);
  const headings: string[] = [];
  for (const m of raw.matchAll(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi)) {
    const t = decodeEntities(stripTags(m[1])).replace(/\s+/g, " ").trim();
    if (t) headings.push(t);
  }

  // Prefer <main>/<article> when present — avoids nav/footer noise.
  const main = /<article[^>]*>([\s\S]*?)<\/article>/i.exec(raw)?.[1]
    ?? /<main[^>]*>([\s\S]*?)<\/main>/i.exec(raw)?.[1]
    ?? raw;

  const body = decodeEntities(stripTags(main))
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (body.length < 200) {
    warnings.push(
      "Only a small amount of readable text was found. The page may require JavaScript or restrict access.",
    );
  }

  return {
    documentTitle: (titleMatch ? decodeEntities(titleMatch[1]).trim() : headings[0]) || filename,
    documentType: "html",
    extractedText: body,
    headings,
    tables: [],
    metadata: { headingCount: headings.length },
    warnings,
  };
}
