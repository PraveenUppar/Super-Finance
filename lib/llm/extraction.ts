import { extractionSchemaFor } from '../facts/schema';
import type { FactBase } from '../facts/schema';
import type { LlmClient, StructuredResponse } from './client';

/**
 * The extraction harness (S7) — same shape as `narrative.ts`'s harness,
 * because the same discipline applies: one system prompt every caller
 * shares, so "never invent" cannot quietly stop being enforced somewhere.
 *
 * D47, the hard way: `extractionSchemaFor()` alone is not enough. The first
 * real call this project made against it invented a CIN, a date and a
 * website to satisfy a schema `required` array — fixed there, but the
 * lesson generalises to the prompt too: say plainly that a missing field
 * should be OMITTED, not guessed, since a model under schema pressure will
 * reach for a plausible value unless told not to in so many words.
 */
const NO_INVENTION_EXTRACTION_PROMPT = `You extract facts from a page of an Indian SME IPO prospectus or a supporting corporate document (certificate of incorporation, board resolution, PAS-3 filing, etc.) into the given JSON schema.

Extract ONLY facts explicitly stated in the document text below. Never invent, infer, guess, or fill in a plausible-sounding value for a fact not present in the text — this includes a CIN, a date, an address, an email, a website or a phone number that is not itself printed in the text. Where the text does not state a field, OMIT that field from your response entirely. A wrong or invented fact in a legal offer document is a statutory liability (Companies Act s.34/35) — omission is always the safer answer than a guess.`;

export interface ExtractionRequest {
  domain: keyof FactBase;
  /** The targeted page text (see `page-targeting.ts`) — never the whole document. */
  pageText: string;
}

export async function extractFacts<T = unknown>(
  client: LlmClient,
  req: ExtractionRequest,
): Promise<StructuredResponse<T>> {
  const schema = extractionSchemaFor(req.domain);
  const prompt = `Extract facts for the "${req.domain}" section of the fact base from the following document pages:\n\n${req.pageText}`;
  return client.generateStructured<T>({ systemInstruction: NO_INVENTION_EXTRACTION_PROMPT, prompt, schema });
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Every primitive leaf inside an extracted value, however nested. */
function leafValues(value: unknown): string[] {
  if (value === null || value === undefined || value === '') return [];
  if (typeof value === 'string') return [value];
  if (typeof value === 'number') return [String(value)];
  if (typeof value === 'boolean') return [];
  if (Array.isArray(value)) return value.flatMap(leafValues);
  if (typeof value === 'object') return Object.values(value as Record<string, unknown>).flatMap(leafValues);
  return [];
}

/**
 * Confidence flagging — mechanical, never self-reported by the model.
 *
 * The same lesson D18 established for provenance generally (asking the model
 * to report its own confidence invites exactly the fabrication the field
 * exists to catch) applies here: this checks, after the fact, how much of a
 * field's own value can be found close to verbatim in the page text it was
 * extracted from — the identical discipline as `narrative.ts`'s
 * `untraceableNumbers()`, generalised from "every number" to "every leaf
 * value" since an extracted field can be a name or an address, not only a
 * figure. 1 = every leaf found in the source text; 0 = none were. A field
 * with no checkable leaves (e.g. a bare boolean) reads as 1 — there is
 * nothing for this check to catch a fabrication of.
 */
export function fieldConfidence(value: unknown, sourceText: string): number {
  const leaves = leafValues(value);
  if (leaves.length === 0) return 1;
  const haystack = normalize(sourceText);
  const found = leaves.filter((leaf) => {
    const needle = normalize(leaf);
    return needle.length > 0 && haystack.includes(needle);
  }).length;
  return found / leaves.length;
}
