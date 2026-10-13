/**
 * OPTIONAL AI synthesis layer.
 *
 * This is disabled by default and is never required for any core feature.
 * It exists so that a deployment which explicitly opts in can add
 * multi-source synthesis on top of the deterministic engine.
 *
 * Supported: any OpenAI-compatible endpoint (OpenAI, OpenRouter, Ollama,
 * vLLM, LM Studio, ...). Only the *relevant context* is ever sent — never a
 * whole document — and results are cached.
 */

import { config } from "../config";
import { cached } from "../cache/store";
import { fetchJson } from "./http";
import type { AIProvider } from "./types";

export class OpenAICompatibleProvider implements AIProvider {
  readonly id = "openai-compatible";
  readonly label = config.ai.provider || "OpenAI-compatible";

  isEnabled() {
    return config.ai.enabled && config.ai.apiKey !== "" && config.ai.baseUrl !== "";
  }

  async complete(prompt: string, opts: { maxTokens?: number; system?: string } = {}): Promise<string> {
    if (!this.isEnabled()) throw new Error("AI provider is not enabled.");

    const { value } = await cached(`ai:${hash(prompt)}`, 86400, async () => {
      const data = await fetchJson<{ choices?: Array<{ message?: { content?: string } }> }>(
        `${config.ai.baseUrl.replace(/\/$/, "")}/chat/completions`,
        {
          label: "AI provider",
          timeoutMs: 30000,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${config.ai.apiKey}`,
          },
        },
      );
      return data.choices?.[0]?.message?.content ?? "";
    });

    return value;
  }
}

function hash(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

export function aiProvider(): AIProvider {
  return new OpenAICompatibleProvider();
}

/**
 * The only AI feature the product exposes, and only when opted in: a
 * bounded synthesis over already-retrieved snippets. The UI marks output as
 * "AI interpretation" and never merges it with source claims.
 */
export async function synthesise(
  question: string,
  snippets: Array<{ title: string; text: string }>,
): Promise<{ text: string; usedContext: number } | null> {
  const provider = aiProvider();
  if (!provider.isEnabled()) return null;

  const context = snippets
    .slice(0, 6)
    .map((s, i) => `[${i + 1}] ${s.title}\n${s.text.slice(0, 800)}`)
    .join("\n\n");

  const prompt = `Question: ${question}\n\nRetrieved context:\n${context}\n\nWrite a short synthesis. Cite sources as [1], [2]. If the context is insufficient, say so plainly.`;

  const text = await provider.complete(prompt, {
    maxTokens: 600,
    system: "You are a careful research assistant. Never invent sources. Distinguish what the sources say from your own inference.",
  });
  return { text, usedContext: snippets.length };
}

export function aiStatus() {
  return {
    enabled: config.ai.enabled,
    provider: config.ai.provider || null,
    model: config.ai.model || null,
    configured: config.ai.enabled && config.ai.apiKey !== "" && config.ai.baseUrl !== "",
  };
}
