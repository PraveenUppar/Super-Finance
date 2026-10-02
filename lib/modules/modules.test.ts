import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { listVersions, readFactBase, readVersion, writeFacts } from '../store/fact-store';
import { createFakeVersionedTable, __setVersionedTableForTests } from '../store/versioned-table';
import { extractedProvenance } from '../facts/provenance';
import {
  allProgress,
  applicableFields,
  feedsIntoTitles,
  fieldStatus,
  findModule,
  isAnswered,
  m1Company,
  moduleRegistry,
} from './index';
import { sectionRegistry } from '../document/sections';
import { plannedSections } from '../document/sections/planned';
import { vardhman } from '../seed/vardhman';
import type { PartialFactBase } from '../facts/schema';

describe('the module spec', () => {
  it('addresses every field by a fact path, so a question is asked once', () => {
    // "Ask once" is structural, not a discipline: the company name is one path
    // read ~200 times, not one question repeated.
    const paths = moduleRegistry.flatMap((m) => m.fields.map((f) => f.path));
    expect(new Set(paths).size).toBe(paths.length);
    for (const p of paths) expect(p).toMatch(/^[a-z][A-Za-z]*\./);
  });

  it('gives every field a reason and a destination', () => {
    // A field with no helpText is a form; a field with helpText is a teacher.
    for (const field of m1Company.fields) {
      expect(field.helpText.length, field.path).toBeGreaterThan(40);
      expect(field.feedsInto.length, field.path).toBeGreaterThan(0);
    }
  });

  it('points feedsInto at sections that exist, built or planned', () => {
    // Built resolves to a title; planned resolves to a title marked as not
    // yet drafted; anything else is a typo, and a typo here promises the
    // issuer a place their answer never appears.
    const ids = new Set([...sectionRegistry.map((s) => s.id), ...Object.keys(plannedSections)]);
    const dangling = moduleRegistry
      .flatMap((m) => m.fields.flatMap((f) => f.feedsInto))
      .filter((id) => !ids.has(id));
    expect([...new Set(dangling)]).toEqual([]);
  });

  it('never lists a planned section that has since been built', () => {
    const built = new Set(sectionRegistry.map((s) => s.id));
    expect(Object.keys(plannedSections).filter((id) => built.has(id))).toEqual([]);
  });

  it('resolves feedsInto to titles a person recognises', () => {
    // `plannedSections` is empty as of D73 — every subsection the section map
    // names is built (`aboutCompany.keyRegulations`, this test's planned
    // example until now, moved to the registry as an `external` stub). Added
    // back temporarily to prove the "planned, not yet drafted" branch still
    // works for whenever a future module names a section that isn't built yet.
    plannedSections['test.notYetBuilt'] = 'A Section Not Yet Built';
    try {
      const titles = feedsIntoTitles(['general.definitions', 'test.notYetBuilt', 'not.a.section']);
      expect(titles).toEqual(['Definitions and Abbreviations', 'A Section Not Yet Built (not yet drafted)']);
    } finally {
      delete plannedSections['test.notYetBuilt'];
    }
  });
});

describe('showIf keeps the form as short as the issuer is simple', () => {
  it('hides the conversion date until a firm conversion is declared', () => {
    const none: PartialFactBase = { company: { convertedFromFirmType: 'NONE' } as never };
    const llp: PartialFactBase = { company: { convertedFromFirmType: 'LLP' } as never };

    const hidden = applicableFields(m1Company, none).map((f) => f.path);
    const shown = applicableFields(m1Company, llp).map((f) => f.path);

    expect(hidden).not.toContain('company.conversionFromFirmDate');
    expect(shown).toContain('company.conversionFromFirmDate');
  });

  it('asks the name-change revenue test only where a name change exists', () => {
    const clean: PartialFactBase = { company: { nameChanges: [] } as never };
    const renamed: PartialFactBase = {
      company: { nameChanges: [{ previousName: 'A', newName: 'B', date: '2026-06-01' }] } as never,
    };
    expect(applicableFields(m1Company, clean).map((f) => f.path)).not.toContain(
      'company.revenueShareFromNewNameActivity',
    );
    expect(applicableFields(m1Company, renamed).map((f) => f.path)).toContain(
      'company.revenueShareFromNewNameActivity',
    );
  });
});

describe('answered versus empty', () => {
  it('counts false, zero and an explicit None as answers', () => {
    // The commonest bug in a form like this: an issuer with no partly paid
    // shares gets asked forever because `false` reads as blank. Null is the
    // same case for "any pledged shares?" — it is what "None" saves as, and
    // the store never holds it unless someone chose it.
    expect(isAnswered(false)).toBe(true);
    expect(isAnswered(0)).toBe(true);
    expect(isAnswered(null)).toBe(true);
    expect(isAnswered('')).toBe(false);
    expect(isAnswered(undefined)).toBe(false);
  });

  it('validates only what has been answered', () => {
    const field = m1Company.fields.find((f) => f.path === 'company.website')!;
    expect(fieldStatus(field, {}, undefined).issues).toEqual([]);
    expect(fieldStatus(field, {}, 'not-a-url').issues.length).toBeGreaterThan(0);
    expect(fieldStatus(field, {}, 'https://www.example.in').issues).toEqual([]);
  });

  it('runs the live consistency check alongside the schema', () => {
    const field = m1Company.fields.find(
      (f) => f.path === 'company.revenueShareFromNewNameActivity',
    )!;
    expect(fieldStatus(field, {}, 42).issues[0]).toContain('Below 50%');
    expect(fieldStatus(field, {}, 72).issues).toEqual([]);
  });
});

describe('progress', () => {
  it('reports nothing answered for a new issuer', () => {
    const [p] = allProgress({});
    expect(p.answered).toBe(0);
    expect(p.percent).toBe(0);
    expect(p.unlocked).toBe(true); // M1 depends on nothing
  });

  it('reports M1 complete for the seeded issuer', () => {
    const [p] = allProgress(vardhman);
    expect(p.withIssues).toBe(0);
    expect(p.answered).toBe(p.applicable);
    expect(p.percent).toBe(100);
  });

  it('counts a field with an issue as unanswered', () => {
    const broken: PartialFactBase = {
      ...vardhman,
      company: { ...vardhman.company, website: 'not-a-url' },
    };
    const [p] = allProgress(broken);
    expect(p.withIssues).toBe(1);
    expect(p.answered).toBeLessThan(p.applicable);
  });

  it('finds a module case-insensitively, since the URL is lowercase', () => {
    expect(findModule('m1')?.id).toBe('M1');
    expect(findModule('M1')?.id).toBe('M1');
    expect(findModule('M99')).toBeUndefined();
  });
});

describe('the fact store', () => {
  const ORG = 'org_test1';

  beforeEach(() => {
    __setVersionedTableForTests(createFakeVersionedTable());
  });

  afterEach(() => {
    __setVersionedTableForTests(null);
  });

  it('appends a version per write and never overwrites', async () => {
    expect((await readFactBase(ORG)).version).toBe(0);

    await writeFacts(ORG, { 'company.name': 'First Name Limited' }, 'issuer');
    await writeFacts(ORG, { 'company.name': 'Second Name Limited' }, 'issuer');

    expect(await listVersions(ORG)).toEqual([1, 2]);
    // The earlier value is still readable — "who changed this, and when" is a
    // question a merchant banker will ask.
    expect((await readVersion(ORG, 1)).facts.company?.name).toBe('First Name Limited');
    expect((await readFactBase(ORG)).facts.company?.name).toBe('Second Name Limited');
  });

  it('does not version a write that changes nothing', async () => {
    await writeFacts(ORG, { 'company.name': 'Same Limited' }, 'issuer');
    const before = (await readFactBase(ORG)).version;
    await writeFacts(ORG, { 'company.name': 'Same Limited' }, 'issuer');
    // Autosave fires on every blur; a version per blur would bury real edits.
    expect((await readFactBase(ORG)).version).toBe(before);
  });

  it('records who supplied each fact', async () => {
    await writeFacts(ORG, { 'company.cin': 'U29253MH2016PLC098765' }, 'issuer');
    const p = (await readFactBase(ORG)).provenance['company.cin'];
    expect(p.source).toBe('user');
    expect(p.updatedBy).toBe('issuer');
  });

  it('accepts a provenanceFor override, for S7 extraction', async () => {
    await writeFacts(
      ORG,
      { 'company.cin': 'U29253MH2016PLC098765' },
      'extraction',
      () => extractedProvenance('doc-1', 4, 0.9),
    );
    const p = (await readFactBase(ORG)).provenance['company.cin'];
    expect(p.source).toBe('extracted');
    expect(p.confirmed).toBe(false);
    expect(p.ref).toEqual({ documentId: 'doc-1', page: 4 });
  });

  it('keeps organizations apart', async () => {
    await writeFacts(ORG, { 'company.name': 'Org One Limited' }, 'issuer');
    expect((await readFactBase('org_other')).version).toBe(0);
  });
});
