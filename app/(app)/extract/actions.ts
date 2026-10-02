'use server';

import { revalidatePath } from 'next/cache';
import { createGeminiClient } from '@/lib/llm/client';
import { extractFacts, fieldConfidence } from '@/lib/llm/extraction';
import { snapshotResponse } from '@/lib/llm/snapshot';
import { pdfPageTexts } from '@/lib/document-intake/pdf-text';
import { targetedText } from '@/lib/document-intake/page-targeting';
import { createSupabaseStorage } from '@/lib/store/document-storage';
import { writeFacts } from '@/lib/store/fact-store';
import { extractedProvenance } from '@/lib/facts/provenance';
import type { FactBase } from '@/lib/facts/schema';
import { currentOrgId } from '@/lib/auth/org-context';
import { DOMAINS } from './domains';

/**
 * S7 — upload a document, extract one domain's facts from it.
 *
 * Two actions, two steps, because the mental model this project is built on
 * (#4, "never invent") demands a human in between them: `uploadAndExtract`
 * returns extracted facts that are NOT yet in the fact base, and
 * `confirmExtraction` is the only path that writes them — with
 * `extractedProvenance()` marking every one `confirmed: false` until this
 * call flips it, so nothing an extraction produces can render in the
 * document by accident (`isUsable()` already refuses an unconfirmed
 * extracted fact — see D47 for what happens when a schema fights that).
 */

export interface ExtractResult {
  documentId: string;
  domain: keyof FactBase;
  targetedPages: number[];
  totalPages: number;
  parsed: Record<string, unknown>;
  /** 0-1 per top-level field — see `fieldConfidence()`. Mechanical, not self-reported by the model. */
  confidence: Record<string, number>;
}

export async function uploadAndExtract(formData: FormData): Promise<ExtractResult> {
  const file = formData.get('file');
  const domain = formData.get('domain') as keyof FactBase;
  if (!(file instanceof File)) throw new Error('No file provided');
  if (!DOMAINS.includes(domain)) throw new Error(`Unknown domain "${domain}"`);

  const bytes = new Uint8Array(await file.arrayBuffer());
  const documentId = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9_.-]/g, '_')}`;

  const storage = createSupabaseStorage();
  await storage.upload(`uploads/${documentId}`, bytes, file.type || 'application/pdf');

  const pages = await pdfPageTexts(bytes);
  const { pages: targetedPages, text } = targetedText(pages, domain);
  if (targetedPages.length === 0) {
    throw new Error(
      `No pages in this document look relevant to "${domain}" — the keyword targeting found nothing. Try a different domain, or the document may not cover it.`,
    );
  }

  const client = createGeminiClient();
  const result = await extractFacts(client, { domain, pageText: text.slice(0, 30000) });

  snapshotResponse(`extraction/${documentId}.${domain}.json`, {
    raw: result.raw,
    domain,
    targetedPages: targetedPages.map((p) => p + 1),
    verifiedAt: new Date().toISOString(),
  });

  const parsed = result.parsed as Record<string, unknown>;
  const confidence: Record<string, number> = {};
  for (const [key, value] of Object.entries(parsed)) {
    confidence[key] = fieldConfidence(value, text);
  }

  return {
    documentId,
    domain,
    targetedPages: targetedPages.map((p) => p + 1),
    totalPages: pages.length,
    parsed,
    confidence,
  };
}

/**
 * Writes only the top-level fields the reviewer checked — everything else
 * the model returned is discarded, not silently written. `page` is the
 * first targeted page, an approximation: the extraction call sees several
 * pages at once, and the schema does not carry a per-field source page back
 * from the model (asking it to would be one more thing it could invent).
 * Good enough to point a reviewer at the right few pages; not a citation.
 *
 * `confidence` carries each field's mechanical `fieldConfidence()` score
 * (computed in `uploadAndExtract`, shown to the reviewer, and now actually
 * recorded) through to `Provenance.confidence` — previously the field
 * existed on `Provenance` but nothing ever set it.
 */
export async function confirmExtraction(
  documentId: string,
  domain: keyof FactBase,
  firstTargetedPage: number,
  confirmedFields: Record<string, unknown>,
  confidence: Record<string, number> = {},
): Promise<{ version: number; written: string[] }> {
  const updates: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(confirmedFields)) {
    updates[`${domain}.${key}`] = value;
  }

  const written = await writeFacts(await currentOrgId(), updates, 'extraction', (path) => {
    const key = path.slice(domain.length + 1);
    return {
      ...extractedProvenance(documentId, firstTargetedPage, confidence[key]),
      confirmed: true,
    };
  });

  revalidatePath('/intake', 'layout');
  revalidatePath('/document', 'layout');

  return { version: written.version, written: Object.keys(updates) };
}
