/**
 * Structured-data parsing: CSV, JSON, XML.
 *
 * The goal is to turn structured data into BOTH a readable text body (for
 * concept extraction) and a preserved tabular representation (for display),
 * without losing headers or key names.
 */

import { XMLParser } from "fast-xml-parser";
import Papa from "papaparse";
import type { ParsedDocument } from "../types";

export function parseCsv(buffer: Buffer, filename: string): ParsedDocument {
  const raw = buffer.toString("utf8").replace(/^\uFEFF/, "");
  const result = Papa.parse<string[]>(raw, {
    skipEmptyLines: "greedy",
    dynamicTyping: false,
  });

  const rows = (result.data as unknown as string[][]).filter(Array.isArray);
  const warnings: string[] = [];
  if (result.errors?.length) {
    warnings.push(`CSV parsing reported ${result.errors.length} issue(s); rows were recovered where possible.`);
  }

  const headers = rows[0] ?? [];
  const hasHeader = headers.every((h) => h && Number.isNaN(Number(h)));
  const bodyRows = hasHeader ? rows.slice(1) : rows;

  const lines: string[] = [];
  if (hasHeader) lines.push(`Columns: ${headers.join(", ")}`);
  for (const row of bodyRows.slice(0, 2000)) {
    if (!hasHeader) {
      lines.push(row.join(" | "));
    } else {
      lines.push(
        headers
          .map((h, i) => (row[i] !== undefined && row[i] !== "" ? `${h}: ${row[i]}` : ""))
          .filter(Boolean)
          .join("; "),
      );
    }
  }

  return {
    documentTitle: filename.replace(/\.[^.]+$/, ""),
    documentType: "csv",
    extractedText: lines.join("\n"),
    headings: hasHeader ? headers : [],
    tables: [hasHeader ? headers : [], ...bodyRows.slice(0, 200)].filter((r) => r.length > 0),
    metadata: { rows: bodyRows.length, columns: headers.length, hasHeader },
    warnings,
  };
}

/** Flatten an arbitrary JSON value into readable "path: value" lines. */
function flattenJson(value: unknown, path = "", out: string[] = [], depth = 0): string[] {
  if (depth > 8 || out.length > 4000) return out;
  if (value === null || value === undefined) return out;
  if (Array.isArray(value)) {
    value.slice(0, 500).forEach((v, i) => flattenJson(v, `${path}[${i}]`, out, depth + 1));
    return out;
  }
  if (typeof value === "object") {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      flattenJson(v, path ? `${path}.${k}` : k, out, depth + 1);
    }
    return out;
  }
  out.push(path ? `${path}: ${String(value)}` : String(value));
  return out;
}

export function parseJson(buffer: Buffer, filename: string): ParsedDocument {
  const raw = buffer.toString("utf8").replace(/^\uFEFF/, "");
  const warnings: string[] = [];
  try {
    const data = JSON.parse(raw) as unknown;
    const lines = flattenJson(data);
    return {
      documentTitle: filename.replace(/\.[^.]+$/, ""),
      documentType: "json",
      extractedText: lines.join("\n"),
      headings: [],
      tables: [],
      metadata: { topLevelType: Array.isArray(data) ? "array" : typeof data },
      warnings,
    };
  } catch {
    warnings.push("The file is not valid JSON; falling back to raw text extraction.");
    return {
      documentTitle: filename.replace(/\.[^.]+$/, ""),
      documentType: "json",
      extractedText: raw,
      headings: [],
      tables: [],
      metadata: {},
      warnings,
    };
  }
}

export function parseXml(buffer: Buffer, filename: string): ParsedDocument {
  const raw = buffer.toString("utf8").replace(/^\uFEFF/, "");
  const warnings: string[] = [];
  try {
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@",
      textNodeName: "#text",
      trimValues: true,
    });
    const data = parser.parse(raw) as unknown;
    const lines = flattenJson(data);
    return {
      documentTitle: filename.replace(/\.[^.]+$/, ""),
      documentType: "xml",
      extractedText: lines.join("\n"),
      headings: [],
      tables: [],
      metadata: { nodes: lines.length },
      warnings,
    };
  } catch {
    warnings.push("The file could not be parsed as XML; falling back to tag-stripped text.");
    return {
      documentTitle: filename.replace(/\.[^.]+$/, ""),
      documentType: "xml",
      extractedText: raw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
      headings: [],
      tables: [],
      metadata: {},
      warnings,
    };
  }
}
