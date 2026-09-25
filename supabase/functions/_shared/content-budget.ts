// Controlled, explicit budgeting of what is sent to the LLM.
import type { PageExtraction, ContentBlock } from "./extract.ts";

export interface ContentPayload {
  text: string;
  content_truncated: boolean;
  original_chars: number;
  sent_chars: number;
  blocks_total: number;
  blocks_sent: number;
}

export const DEFAULT_CONTENT_BUDGET = 14_000;

function tokenize(s: string): string[] {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").split(/[^a-z0-9]+/).filter((t) => t.length > 2);
}

/** Selects the most relevant blocks (headings always kept) while preserving original order. */
export function budgetBlocks(blocks: ContentBlock[], query: string, budget = DEFAULT_CONTENT_BUDGET): ContentPayload {
  const original = blocks.map((b) => b.text).join("\n");
  const base = { original_chars: original.length, blocks_total: blocks.length };
  if (original.length <= budget) {
    return { ...base, text: original, content_truncated: false, sent_chars: original.length, blocks_sent: blocks.length };
  }
  const q = new Set(tokenize(query));
  const n = blocks.length || 1;
  const scored = blocks.map((b) => {
    const toks = tokenize(b.text);
    const overlap = toks.filter((t) => q.has(t)).length;
    const isHeading = /^h[1-4]$/.test(b.tag);
    const position = 1 - b.index / n; // earlier content slightly preferred
    const lengthBonus = Math.min(b.text.length, 600) / 600;
    return { b, score: (isHeading ? 100 : 0) + overlap * 3 + position * 2 + lengthBonus };
  });
  scored.sort((a, z) => z.score - a.score);
  const chosen = new Set<number>();
  let used = 0;
  for (const { b } of scored) {
    const len = Math.min(b.text.length, 1500) + 1;
    if (used + len > budget) continue;
    chosen.add(b.index);
    used += len;
  }
  const text = blocks.filter((b) => chosen.has(b.index)).map((b) => b.text.slice(0, 1500)).join("\n");
  return { ...base, text, content_truncated: true, sent_chars: text.length, blocks_sent: chosen.size };
}

export function budgetPlainText(text: string, budget = DEFAULT_CONTENT_BUDGET): ContentPayload {
  const truncated = text.length > budget;
  const sent = truncated ? text.slice(0, budget) : text;
  return { text: sent, content_truncated: truncated, original_chars: text.length, sent_chars: sent.length, blocks_total: 1, blocks_sent: 1 };
}

/** Compact metadata section (always included, never truncated away). */
export function metadataSection(p: PageExtraction): string {
  const list = (a: string[], max = 15) => (a.length ? a.slice(0, max).map((x) => `- ${x.slice(0, 200)}`).join("\n") : "(nenhum)");
  return [
    `Title: ${p.title ?? "(ausente)"}`,
    `Meta description: ${p.meta_description ?? "(ausente)"}`,
    `Idioma: ${p.lang ?? "(não declarado)"}`,
    `Autor: ${p.author ?? "(não identificado)"}`,
    `Publicado: ${p.published_date ?? "-"} | Atualizado: ${p.modified_date ?? "-"}`,
    `Schemas JSON-LD: ${p.schema_types.join(", ") || "(nenhum)"}`,
    `H1:\n${list(p.h1, 5)}`,
    `H2:\n${list(p.h2)}`,
    `H3:\n${list(p.h3)}`,
  ].join("\n");
}
