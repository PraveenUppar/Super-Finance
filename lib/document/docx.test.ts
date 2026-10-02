import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { bookmarkName, gapAnchor } from '../anchors';
import { vardhman } from '../seed/vardhman';
import { withAnswers } from '../seed/empty';
import { buildDocument, docxFilename, renderDocx } from './docx';
import { collectPlaceholders, type DocumentNode } from './nodes';
import { collectGaps, renderSections, type RenderedSection } from './section';
import { sectionRegistry } from './sections';
import { createFakeVersionedTable, __setVersionedTableForTests } from '../store/versioned-table';

const ORG = 'org_test1';
// Module-level fixtures below (`sections`, `sparseSections`) render the full
// registry once, at import time — including the narrative sections, which
// read `narrative-store.ts`/`risk-dismissal-store.ts`. No test here writes to
// either store, so one fake installed for the whole file (never reset) is
// enough — no per-test isolation needed the way section.test.ts's did.
__setVersionedTableForTests(createFakeVersionedTable());

/**
 * The DOCX is checked by opening the zip and reading the XML, not by trusting
 * the library. What matters is what Word will see: the heading styles the ToC
 * field reads, the highlight on every gap, the bookmark on its first
 * occurrence, and the watermark in the header until certification.
 */

interface Unpacked {
  document: string;
  header: string;
  settings: string;
  /** Every part's text with XML entities decoded, for content checks. */
  text: string;
}

async function unpack(bytes: Buffer): Promise<Unpacked> {
  const zip = await JSZip.loadAsync(bytes);
  const read = (name: string) => zip.file(name)!.async('string');

  const headerNames = Object.keys(zip.files).filter((f) => /^word\/header\d*\.xml$/.test(f));
  expect(headerNames.length).toBeGreaterThan(0);

  const document = await read('word/document.xml');
  const header = (await Promise.all(headerNames.map(read))).join('\n');
  return {
    document,
    header,
    settings: await read('word/settings.xml'),
    text: decode(document),
  };
}

/** Text nodes only, entities decoded, so raw run text can be looked for. */
function decode(xml: string): string {
  return xml
    .replace(/<[^>]+>/g, '\n')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

const count = (haystack: string, needle: string | RegExp): number =>
  typeof needle === 'string'
    ? haystack.split(needle).length - 1
    : (haystack.match(new RegExp(needle.source, 'g')) ?? []).length;

const sections = await renderSections(sectionRegistry, { orgId: ORG, facts: vardhman });

/** A document with one fact in it: gaps everywhere. */
const sparseFacts = withAnswers({ company: { name: 'Sparse Test Limited' } });
const sparseSections = await renderSections(sectionRegistry, { orgId: ORG, facts: sparseFacts });

const nodesOf = (s: RenderedSection[]): DocumentNode[] => s.flatMap((x) => x.nodes);

describe('renderDocx', () => {
  it('produces a Word file that opens as a zip with the expected parts', async () => {
    const bytes = await renderDocx(sections, { facts: vardhman, version: 3 });
    const zip = await JSZip.loadAsync(bytes);
    for (const part of [
      '[Content_Types].xml',
      'word/document.xml',
      'word/styles.xml',
      'word/numbering.xml',
      'word/settings.xml',
      'word/footer1.xml',
    ]) {
      expect(zip.file(part), part).not.toBeNull();
    }
  });

  it('carries every heading through with the built-in heading styles the ToC reads', async () => {
    const { document } = await unpack(await renderDocx(sections, { facts: vardhman }));

    const headings = nodesOf(sections).filter((n) => n.type === 'heading');
    const byLevel = (level: number) => headings.filter((h) => h.level === level).length;

    // Heading 1 is the group heading, added by the renderer: one per group.
    const groups = new Set(sections.map((s) => s.group)).size;
    expect(count(document, 'w:val="Heading1"')).toBe(groups + byLevel(1));
    expect(count(document, 'w:val="Heading2"')).toBe(byLevel(2));
    expect(count(document, 'w:val="Heading3"')).toBe(byLevel(3));
    expect(count(document, 'w:val="Heading4"')).toBe(byLevel(4));
  });

  it('opens with a table of contents field and asks Word to update it', async () => {
    const { document, settings } = await unpack(await renderDocx(sections, { facts: vardhman }));
    // The field instruction: heading levels 1-3, entries as hyperlinks,
    // flagged dirty so Word recomputes it on open.
    expect(document).toMatch(/<w:instrText[^>]*>TOC \\h \\o (&quot;|")1-3(&quot;|")<\/w:instrText>/);
    expect(document).toContain('w:fldCharType="begin" w:dirty="true"');
    // Bare <w:updateFields/> means true; Word prompts to refresh on open
    expect(settings).toMatch(/<w:updateFields(\s+w:val="true")?\/>/);
  });

  it('renders every paragraph run as text in the document', async () => {
    const { text } = await unpack(await renderDocx(sections, { facts: vardhman }));

    const runs = nodesOf(sections).flatMap((n) => {
      if (n.type === 'paragraph') return n.runs;
      if (n.type === 'list') return n.items.flat();
      return [];
    });
    // Long runs are unambiguous evidence; short ones ("and") prove nothing.
    const distinctive = [...new Set(runs.map((r) => r.text).filter((t) => t.length > 40))];
    expect(distinctive.length).toBeGreaterThan(100);
    for (const run of distinctive) expect(text, run).toContain(run);
  });

  it('never leaks a template expression into the file', async () => {
    const { text } = await unpack(await renderDocx(sparseSections, { facts: sparseFacts }));
    expect(text).not.toContain('{{');
    expect(text).not.toContain('{{#');
  });

  it('highlights every placeholder and bookmarks each gap exactly once', async () => {
    const { document, text } = await unpack(
      await renderDocx(sparseSections, { facts: sparseFacts }),
    );

    const placeholders = collectPlaceholders(nodesOf(sparseSections));
    expect(placeholders.length).toBeGreaterThan(20);
    expect(count(document, '<w:highlight w:val="yellow"/>')).toBe(placeholders.length);

    // The run's own text is what prints — "[TO BE PROVIDED: ...]" for a
    // missing fact, "[TO BE DRAFTED: ...]" for a narrative section.
    const labels = nodesOf(sparseSections).flatMap((n) => {
      const runs = n.type === 'paragraph' ? n.runs : n.type === 'list' ? n.items.flat() : [];
      return runs.filter((r) => r.placeholder).map((r) => r.text);
    });
    for (const label of new Set(labels)) expect(text).toContain(label);

    for (const gap of collectGaps(sparseSections)) {
      const name = bookmarkName(gapAnchor(gap.factPath));
      expect(count(document, `w:name="${name}"`), gap.factPath).toBe(1);
    }
  });

  it('bookmarks every section with the anchor the dashboard links to', async () => {
    const { document } = await unpack(await renderDocx(sections, { facts: vardhman }));
    for (const section of sections) {
      expect(count(document, `w:name="${bookmarkName(section.anchor)}"`), section.id).toBe(1);
    }
  });

  it('renders every table with fixed widths that sum to the text width', async () => {
    const { document } = await unpack(await renderDocx(sections, { facts: vardhman }));

    const tables = nodesOf(sections).filter((n) => n.type === 'table');
    expect(tables.length).toBeGreaterThan(0);
    expect(count(document, '<w:tbl>')).toBe(tables.length);
    expect(count(document, '<w:tblLayout w:type="fixed"/>')).toBe(tables.length);

    // Header rows repeat across a page break; every row refuses to split.
    expect(count(document, '<w:tblHeader/>')).toBe(tables.length);
    const rows = tables.reduce((n, t) => n + t.rows.length + 1, 0);
    expect(count(document, '<w:cantSplit/>')).toBe(rows);

    // Every grid sums to the A4 text width, so nothing can run off the page.
    const A4_TEXT_WIDTH = 11906 - 2 * 1440;
    const grids = document.match(/<w:tblGrid>.*?<\/w:tblGrid>/g) ?? [];
    expect(grids).toHaveLength(tables.length);
    for (const grid of grids) {
      const widths = [...grid.matchAll(/w:w="(\d+)"/g)].map((m) => Number(m[1]));
      expect(widths.reduce((a, b) => a + b, 0)).toBe(A4_TEXT_WIDTH);
    }
  });

  it('gives each ordered list its own numbering instance so every list starts at 1', async () => {
    const orderedLists = nodesOf(sections).filter((n) => n.type === 'list' && n.ordered).length;
    const { document } = await unpack(await renderDocx(sections, { facts: vardhman }));
    // docx emits one w:num per numbering instance; bullets share one.
    const numIds = new Set([...document.matchAll(/<w:numId w:val="(\d+)"\/>/g)].map((m) => m[1]));
    expect(numIds.size).toBe(orderedLists + 1);
  });

  it('carries the unsigned-draft notice in the running header until certified', async () => {
    const draft = await unpack(await renderDocx(sections, { facts: vardhman }));
    expect(draft.header).toContain('UNSIGNED DRAFT — NOT FOR FILING</w:t>');
    // No page watermark, by decision (D35): nothing may paint over the body
    expect(draft.header).not.toContain('<v:shape');
    expect(draft.header).not.toContain('<w:framePr');

    const certified = await unpack(await renderDocx(sections, { facts: vardhman, certified: true }));
    expect(certified.header).not.toContain('UNSIGNED DRAFT');
    expect(certified.text).not.toContain('UNSIGNED DRAFT');
    // The running title survives certification; only the notice goes
    expect(certified.header).toContain(vardhman.company.name);
  });

  it('pre-fills the table of contents so it is never blank before Word updates it', async () => {
    const { document } = await unpack(await renderDocx(sections, { facts: vardhman }));
    const toc = document.match(/<w:sdt>.*?<\/w:sdt>/)![0];

    // Every numbered section and every subsection title is an entry that
    // links to its bookmark; page numbers wait for Word's field update.
    for (const group of new Set(sections.map((s) => s.group))) {
      expect(toc, group).toContain(`>${group}</w:t>`);
    }
    for (const section of sections) {
      expect(toc, section.id).toContain(`w:anchor="${bookmarkName(section.anchor)}"`);
    }
    // Deeper headings are listed too, to the depth the field will produce
    const level3 = nodesOf(sections).filter((n) => n.type === 'heading' && n.level === 3);
    expect(level3.length).toBeGreaterThan(0);
    expect(toc).toContain(`>${level3[0].type === 'heading' ? level3[0].text : ''}</w:t>`);
  });

  it('numbers pages in the footer', async () => {
    const zip = await JSZip.loadAsync(await renderDocx(sections, { facts: vardhman }));
    const footer = await zip.file('word/footer1.xml')!.async('string');
    expect(footer).toContain('PAGE');
    expect(footer).toContain('NUMPAGES');
  });

  it('names the file after the issuer, the stage and the state', () => {
    expect(docxFilename(vardhman, { version: 3 })).toBe(
      'vardhman-precision-components-limited-drhp-v3-unsigned-draft.docx',
    );
    expect(docxFilename(vardhman, { certified: true })).toBe(
      'vardhman-precision-components-limited-drhp.docx',
    );
  });

  it('builds without throwing for the demo issuer and for a near-empty one', () => {
    expect(() => buildDocument(sections, { facts: vardhman })).not.toThrow();
    expect(() => buildDocument(sparseSections, { facts: sparseFacts })).not.toThrow();
  });

  /**
   * Not a check — a way to get the file onto disk for LibreOffice or Word.
   *
   *   SETU_DOCX_OUT=out/vardhman.docx npx vitest run lib/document/docx.test.ts
   */
  it.runIf(process.env.SETU_DOCX_OUT)('writes the rendered file to SETU_DOCX_OUT', async () => {
    const out = process.env.SETU_DOCX_OUT!;
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, await renderDocx(sections, { facts: vardhman, version: 0 }));
    writeFileSync(
      out.replace(/\.docx$/, '-certified.docx'),
      await renderDocx(sections, { facts: vardhman, version: 0, certified: true }),
    );
    writeFileSync(
      out.replace(/\.docx$/, '-sparse.docx'),
      await renderDocx(sparseSections, { facts: sparseFacts, version: 1 }),
    );
  });
});

describe('bookmarkName', () => {
  it('satisfies Word: 40 characters at most, letters, digits and underscores, leading letter', () => {
    const anchors = [
      ...sections.map((s) => s.anchor),
      ...collectGaps(sparseSections).map((g) => gapAnchor(g.factPath)),
    ];
    expect(anchors.some((a) => a.length > 40)).toBe(true);
    for (const anchor of anchors) {
      const name = bookmarkName(anchor);
      expect(name.length, anchor).toBeLessThanOrEqual(40);
      expect(name, anchor).toMatch(/^[A-Za-z][A-Za-z0-9_]*$/);
    }
  });

  it('keeps distinct anchors distinct after truncation', () => {
    const anchors = [
      ...sections.map((s) => s.anchor),
      ...collectGaps(sparseSections).map((g) => gapAnchor(g.factPath)),
    ];
    const names = anchors.map(bookmarkName);
    expect(new Set(names).size).toBe(new Set(anchors).size);

    // Two long anchors sharing their first 31 characters still differ
    const a = bookmarkName('sec-issue-procedure-bids-by-investor-category');
    const b = bookmarkName('sec-issue-procedure-bids-by-investor-categories');
    expect(a).not.toBe(b);
    expect(a.slice(0, 31)).toBe(b.slice(0, 31));
  });

  it('is stable', () => {
    expect(bookmarkName('sec-general-conventions')).toBe('sec_general_conventions');
    expect(bookmarkName('sec-issue-procedure-bids-by-investor-category')).toBe(
      bookmarkName('sec-issue-procedure-bids-by-investor-category'),
    );
  });
});
