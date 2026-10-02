import JSZip from 'jszip';
import { docxFilename, renderDocx } from '../document/docx';
import { renderSections, type RenderedSection } from '../document/section';
import { sectionRegistry } from '../document/sections';
import type { ProvenanceMap } from '../facts/provenance';
import type { FactBase } from '../facts/schema';
import { loadIssuer } from '../issuer';
import type { Finding, ReadinessSummary } from '../rules';
import { assess } from '../rules/document-assess';
import { readCertification } from '../store/certification-store';
import { buildGapReport, gapReportFilename } from './gap-report';
import { docxToPdf, PdfUnavailableError } from './pdf';

/**
 * Everything the exports share, assembled once.
 *
 * The preview, the DOCX, the gap report and the vault must all describe the
 * SAME issuer at the SAME version, or a banker downloads a report about a
 * document other than the one in their hand. So there is one assembly, and
 * every route calls it rather than loading facts for itself.
 */
export interface Assembled {
  facts: FactBase;
  provenance: ProvenanceMap;
  version: number;
  isDemo: boolean;
  sections: RenderedSection[];
  findings: Finding[];
  summary: ReadinessSummary;
  /** Whether the merchant banker has certified the document (S12) — see `lib/store/certification-store.ts`. */
  certified: boolean;
}

export async function assemble(orgId: string): Promise<Assembled> {
  const { facts, isDemo, version, provenance } = await loadIssuer(orgId);
  const sections = await renderSections(sectionRegistry, { orgId, facts });
  const { findings, summary } = assess(facts, sections);
  const certified = (await readCertification(orgId)).certified;
  return { facts, provenance, version, isDemo, sections, findings, summary, certified };
}

export const slugOf = (facts: FactBase) =>
  (facts.company.name || 'issuer')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();

export interface VaultResult {
  zip: Buffer;
  filename: string;
  /** Present when LibreOffice was not available: the vault ships without a PDF and says so. */
  pdfOmitted?: string;
}

/**
 * The document vault: the deliverable and its working papers in one archive.
 *
 *   <slug>-<stage>-v<n>-unsigned-draft.docx   the document
 *   <slug>-<stage>-v<n>-unsigned-draft.pdf    its print, when LibreOffice is there
 *   <slug>-gap-report-v<n>.xlsx               findings, placeholders, provenance
 *   fact-base-v<n>.json                       every fact as the document read it
 *   provenance-v<n>.json                      who supplied each fact, and when
 *   manifest.json                             what is in here, and the readiness score
 *
 * The fact base and provenance go in because the DOCX is not self-describing:
 * a figure in a table traces to a fact path, and the fact path traces to a
 * person and a date, and a banker doing diligence wants that chain in the
 * same folder as the document.
 */
export async function buildVault(a: Assembled): Promise<VaultResult> {
  const options = { facts: a.facts, version: a.version, certified: a.certified };
  const docx = await renderDocx(a.sections, options);
  const docxName = docxFilename(a.facts, options);
  const xlsx = await buildGapReport({ ...a, sections: a.sections });
  const xlsxName = gapReportFilename(a.facts, a.version);

  let pdf: Buffer | null = null;
  let pdfOmitted: string | undefined;
  try {
    pdf = await docxToPdf(docx, docxName.replace(/\.docx$/, ''));
  } catch (e) {
    pdfOmitted = e instanceof PdfUnavailableError ? e.message : `PDF conversion failed: ${(e as Error).message}`;
  }

  const zip = new JSZip();
  zip.file(docxName, docx);
  if (pdf) zip.file(docxName.replace(/\.docx$/, '.pdf'), pdf);
  zip.file(xlsxName, xlsx);
  zip.file(`fact-base-v${a.version}.json`, JSON.stringify(a.facts, null, 2));
  zip.file(`provenance-v${a.version}.json`, JSON.stringify(a.provenance, null, 2));
  zip.file(
    'manifest.json',
    JSON.stringify(
      {
        company: a.facts.company.name,
        documentStage: a.facts.offer.documentStage,
        factBaseVersion: a.version,
        isDemoIssuer: a.isDemo,
        generatedAt: new Date().toISOString(),
        readiness: a.summary,
        findings: a.findings.length,
        subsectionsRendered: new Set(a.sections.map((s) => s.partOf)).size,
        files: [docxName, ...(pdf ? [docxName.replace(/\.docx$/, '.pdf')] : []), xlsxName, `fact-base-v${a.version}.json`, `provenance-v${a.version}.json`],
        ...(pdfOmitted ? { pdfOmitted } : {}),
        state: a.certified ? 'CERTIFIED' : 'UNSIGNED DRAFT - NOT FOR FILING',
      },
      null,
      2,
    ),
  );

  return {
    zip: await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }),
    filename: `${slugOf(a.facts)}-vault-v${a.version}.zip`,
    pdfOmitted,
  };
}
