import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { renderSections } from '../document/section';
import { sectionRegistry } from '../document/sections';
import { userProvenance } from '../facts/provenance';
import { assess } from '../rules/document-assess';
import { withAnswers } from '../seed/empty';
import { vardhman } from '../seed/vardhman';
import { buildVault, type Assembled } from './bundle';
import { buildGapReport, gapReportFilename, whereToFix } from './gap-report';
import { docxToPdf, findSoffice, PdfUnavailableError } from './pdf';
import { createFakeVersionedTable, __setVersionedTableForTests } from '../store/versioned-table';

/**
 * The exports are checked by opening what they produce — the workbook, the
 * zip — not by trusting the builders. What matters is what the banker sees.
 */

const ORG = 'org_test1';

beforeEach(() => {
  __setVersionedTableForTests(createFakeVersionedTable());
});
afterEach(() => {
  __setVersionedTableForTests(null);
});

async function assembled(facts = vardhman, version = 3): Promise<Assembled> {
  const sections = await renderSections(sectionRegistry, { orgId: ORG, facts });
  const { findings, summary } = assess(facts, sections);
  return {
    facts,
    version,
    isDemo: false,
    provenance: {
      'company.name': userProvenance('issuer'),
      'capital.faceValue': { ...userProvenance('cs'), updatedAt: '2026-09-11T10:00:00.000Z' },
    },
    sections,
    findings,
    summary,
    certified: false,
  };
}

/** exceljs types its own Buffer, which is not Node's; the bytes are the same. */
async function open(bytes: Buffer): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(bytes as unknown as ArrayBuffer);
  return wb;
}

const sheetRows = (sheet: ExcelJS.Worksheet) => {
  const rows: unknown[][] = [];
  sheet.eachRow((row) => rows.push((row.values as unknown[]).slice(1)));
  return rows;
};

describe('where to fix', () => {
  it('resolves a fact path to the module and the question that answers it', () => {
    expect(whereToFix('company.website')).toEqual({ module: 'M1', question: 'Company website' });
    expect(whereToFix('offer.issuePrice')).toBeNull(); // fixed at pricing, not asked in a module
    expect(whereToFix('management.directors')).toEqual({ module: 'M4', question: 'Board of Directors' });
  });

  it('takes the longest prefix, so a nested path lands on its own question', () => {
    expect(whereToFix('capital.depositoryAgreements.nsdlDate')).toEqual({
      module: 'M8',
      question: 'Date of the NSDL tripartite agreement',
    });
    expect(whereToFix('capital.allotments[3].issuePrice')).toEqual({
      module: 'M2',
      question: 'Allotment history since incorporation',
    });
  });
});

describe('the gap report workbook', () => {
  it('has the three sheets, with every finding and every placeholder as a row', async () => {
    const a = await assembled();
    const wb = await open(await buildGapReport(a));
    expect(wb.worksheets.map((s) => s.name)).toEqual(['Findings', 'Placeholders', 'Provenance']);

    const findings = sheetRows(wb.getWorksheet('Findings')!);
    const header = findings.findIndex((r) => r[0] === '#');
    expect(findings[header]).toEqual(['#', 'Severity', 'Category', 'Rule', 'Finding', 'Clause', 'Detail', 'Holds up', 'Fix in module', 'Question', 'Fact path', 'Banker notes']);
    expect(findings.length - header - 1).toBe(a.findings.length);
    // The readiness line agrees with the dashboard
    expect(findings.some((r) => r[0] === `Readiness ${a.summary.score} / 100`)).toBe(true);
  });

  it('names the module and question for a gap, not just the path', async () => {
    const a = await assembled();
    const wb = await open(await buildGapReport(a));
    const rows = sheetRows(wb.getWorksheet('Placeholders')!);
    const escrow = rows.find((r) => r[2] === 'offer.anchorEscrowAccountResident')!;
    expect(escrow[5]).toBe('M9');
    expect(escrow[6]).toBe('Name of the escrow account for resident Anchor Investors');
    expect(escrow[4]).toContain('Terms of Payment and Payment Mechanism');
  });

  it('lists provenance per fact, and says so when there is none', async () => {
    const withProv = await open(await buildGapReport(await assembled()));
    const rows = sheetRows(withProv.getWorksheet('Provenance')!);
    expect(rows.find((r) => r[0] === 'capital.faceValue')?.slice(1, 4)).toEqual(['user', 'cs', '2026-09-11T10:00:00.000Z']);

    const none = await open(await buildGapReport({ ...await assembled(), provenance: {} }));
    expect(sheetRows(none.getWorksheet('Provenance')!).some((r) => String(r[0]).startsWith('No provenance on file'))).toBe(true);
  });

  it('renders a one-fact issuer with dozens of placeholders and no seed text', async () => {
    const sparse = withAnswers({ company: { name: 'Sparse Test Limited' } });
    const a = await assembled(sparse, 1);
    const wb = await open(await buildGapReport(a));
    const rows = sheetRows(wb.getWorksheet('Placeholders')!);
    expect(rows.length).toBeGreaterThan(50);
    expect(JSON.stringify(rows)).not.toContain('Vardhman');
    expect(gapReportFilename(sparse, 1)).toBe('sparse-test-limited-gap-report-v1.xlsx');
  });
});

describe('the PDF print', () => {
  const original = process.env.SETU_SOFFICE;
  afterEach(() => {
    if (original === undefined) delete process.env.SETU_SOFFICE;
    else process.env.SETU_SOFFICE = original;
  });

  it('refuses plainly when LibreOffice is not there, rather than faking a PDF', async () => {
    process.env.SETU_SOFFICE = 'C:\\definitely\\not\\here\\soffice.exe';
    expect(findSoffice()).toBeNull();
    await expect(docxToPdf(Buffer.from('not a docx'))).rejects.toBeInstanceOf(PdfUnavailableError);
  });

  it('refuses plainly on a serverless host with no LibreOffice on PATH (e.g. Vercel), not with a raw spawn error', async () => {
    // On non-Windows, findSoffice() cannot verify PATH without running it, so
    // it optimistically returns the bare command name 'soffice' and lets the
    // spawn fail — the normal case on Vercel, which has no LibreOffice at
    // all. That failure (ENOENT) must surface as the same clean
    // PdfUnavailableError as the "not configured" case above, not as
    // "PDF conversion failed: spawn soffice ENOENT".
    delete process.env.SETU_SOFFICE;
    const originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', { value: 'linux' });
    try {
      expect(findSoffice()).toBe('soffice');
      await expect(docxToPdf(Buffer.from('not a docx'))).rejects.toBeInstanceOf(PdfUnavailableError);
    } finally {
      Object.defineProperty(process, 'platform', { value: originalPlatform });
    }
  });

  it.runIf(findSoffice() !== null && process.env.SETU_SOFFICE === undefined)(
    'prints the DOCX to a PDF where LibreOffice is installed',
    async () => {
      const { renderDocx } = await import('../document/docx');
      const docx = await renderDocx((await assembled()).sections, { facts: vardhman });
      const pdf = await docxToPdf(docx, 'test');
      expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
      expect(pdf.byteLength).toBeGreaterThan(50_000);
    },
    180_000,
  );
});

describe('the vault', () => {
  it('holds the document, the report, the facts, the provenance and a manifest that agrees with them', async () => {
    process.env.SETU_SOFFICE = 'C:\\definitely\\not\\here\\soffice.exe';
    try {
      const a = await assembled();
      const { zip, filename, pdfOmitted } = await buildVault(a);
      expect(filename).toBe('vardhman-precision-components-limited-vault-v3.zip');
      expect(pdfOmitted).toContain('LibreOffice');

      const archive = await JSZip.loadAsync(zip);
      const names = Object.keys(archive.files).sort();
      expect(names).toEqual([
        'fact-base-v3.json',
        'manifest.json',
        'provenance-v3.json',
        'vardhman-precision-components-limited-drhp-v3-unsigned-draft.docx',
        'vardhman-precision-components-limited-gap-report-v3.xlsx',
      ]);

      const manifest = JSON.parse(await archive.file('manifest.json')!.async('string'));
      expect(manifest.factBaseVersion).toBe(3);
      expect(manifest.readiness.score).toBe(a.summary.score);
      expect(manifest.findings).toBe(a.findings.length);
      expect(manifest.subsectionsRendered).toBe(37);
      expect(manifest.state).toBe('UNSIGNED DRAFT - NOT FOR FILING');
      expect(manifest.pdfOmitted).toContain('LibreOffice');
      expect(manifest.files).not.toContain(expect.stringMatching(/\.pdf$/));

      const facts = JSON.parse(await archive.file('fact-base-v3.json')!.async('string'));
      expect(facts.company.name).toBe(vardhman.company.name);
      const prov = JSON.parse(await archive.file('provenance-v3.json')!.async('string'));
      expect(prov['capital.faceValue'].updatedBy).toBe('cs');
    } finally {
      delete process.env.SETU_SOFFICE;
    }
  });
});
