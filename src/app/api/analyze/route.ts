import { NextResponse } from "next/server";
import { config } from "@/lib/config";
import { parseDocument, UnsupportedFormatError, FileValidationError, ACCEPTED_EXTENSIONS } from "@/lib/parsers";
import { parseHtml } from "@/lib/parsers/html";
import { explore, exploreCached } from "@/lib/explore/engine";
import { getCurrentUser } from "@/lib/auth";
import { getStore } from "@/lib/store";
import { checkRateLimit, clientKey, toUsageRecord } from "@/lib/limits";
import { fetchText } from "@/lib/providers/http";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/analyze
 * Accepts multipart/form-data with EITHER:
 *   - file: an uploaded document (multi-format)
 *   - text: pasted text or a topic
 *   - url:  a public page URL
 * Returns a full ExplorationResult.
 */
export async function POST(req: Request) {
  const started = Date.now();
  const limit = checkRateLimit(`analyze:${clientKey(req)}`);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((limit.resetAt - Date.now()) / 1000)) } },
    );
  }

  const contentType = req.headers.get("content-type") ?? "";

  try {
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      if (!(file instanceof File)) {
        return NextResponse.json({ error: "No file was provided." }, { status: 400 });
      }

      const maxBytes = config.limits.maxUploadMb * 1024 * 1024;
      if (file.size > maxBytes) {
        return NextResponse.json(
          { error: `File is ${(file.size / 1024 / 1024).toFixed(1)} MB; the limit is ${config.limits.maxUploadMb} MB.` },
          { status: 413 },
        );
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const parsed = await parseDocument(buffer, file.name, file.type, { maxBytes });

      const refresh = form.get("refresh") === "1";
      const exploreInput = {
        text: parsed.extractedText,
        kind: "file" as const,
        label: parsed.documentTitle,
        documentTitle: parsed.documentTitle,
        documentType: parsed.documentType,
        sourceName: file.name,
      };
      const { result, cached } = refresh
        ? { result: await explore(exploreInput), cached: false }
        : await exploreCached(exploreInput);

      result.warnings = [...parsed.warnings, ...result.warnings];

      // Persist for signed-in users (best-effort; never blocks the response).
      const user = await getCurrentUser().catch(() => null);
      if (user) {
        void getStore()
          .recordUsage(
            toUsageRecord({
              userId: user.id,
              feature: "analyze",
              searchCalls: result.providers.filter((p) => p.status === "ok").length,
              processingTimeMs: Date.now() - started,
              cacheHit: cached,
            }),
          )
          .catch(() => undefined);
      }

      return NextResponse.json({ result, cached });
    }

    // JSON body: text / topic / url
    const body = (await req.json()) as {
      text?: string;
      query?: string;
      url?: string;
      kind?: "topic" | "text" | "url";
      refresh?: boolean;
    };

    let text = (body.text ?? body.query ?? "").trim();
    let kind: "topic" | "text" | "url" = body.kind ?? (text.length < 160 ? "topic" : "text");
    let label = text.slice(0, 120);
    let documentTitle: string | undefined;

    if (body.url) {
      const url = normaliseUrl(body.url);
      if (!url) return NextResponse.json({ error: "That does not look like a valid http(s) URL." }, { status: 400 });
      try {
        const html = await fetchText(url, { label: "page fetch", timeoutMs: 10000 });
        const parsed = parseHtml(html, url);
        text = parsed.extractedText;
        documentTitle = parsed.documentTitle;
        kind = "url";
        label = parsed.documentTitle || url;
      } catch (err) {
        return NextResponse.json(
          {
            error: `Could not retrieve that page: ${(err as Error).message}. Some sites block automated retrieval — paste the text instead.`,
          },
          { status: 502 },
        );
      }
    }

    if (text.length < 3) {
      return NextResponse.json({ error: "Please provide some text, a topic, or a file." }, { status: 400 });
    }

    const exploreInput = {
      text,
      kind,
      label,
      documentTitle,
      documentType: kind === "topic" ? "topic" : kind,
      url: body.url,
    };
    const { result, cached } = body.refresh
      ? { result: await explore(exploreInput), cached: false }
      : await exploreCached(exploreInput);

    return NextResponse.json({ result, cached });
  } catch (err) {
    if (err instanceof UnsupportedFormatError) {
      return NextResponse.json({ error: err.message, accepted: ACCEPTED_EXTENSIONS }, { status: 415 });
    }
    if (err instanceof FileValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: `Analysis failed: ${(err as Error).message}` },
      { status: 500 },
    );
  }
}

function normaliseUrl(input: string): string | null {
  try {
    const u = new URL(input.trim());
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    // Refuse obvious local/private targets.
    const host = u.hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1" || host.endsWith(".local") || /^10\.|^192\.168\.|^172\.(1[6-9]|2\d|3[01])\./.test(host)) {
      return null;
    }
    return u.toString();
  } catch {
    return null;
  }
}
