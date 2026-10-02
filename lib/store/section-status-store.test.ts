import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readStatus, writeStatus, listStatusVersions, readStatusVersion } from './section-status-store';
import { createFakeVersionedTable, __setVersionedTableForTests } from './versioned-table';

const ORG = 'org_test1';

describe('the section status store', () => {
  beforeEach(() => {
    __setVersionedTableForTests(createFakeVersionedTable());
  });

  afterEach(() => {
    __setVersionedTableForTests(null);
  });

  it('defaults to Draft for a section never touched', async () => {
    const status = await readStatus(ORG, 'general.forwardLookingStatements');
    expect(status.status).toBe('DRAFT');
    expect(status.version).toBe(0);
  });

  it('records who moved a section forward, as a new version', async () => {
    const record = await writeStatus(ORG, 'aboutCompany.ourBusiness', 'READY_FOR_REVIEW', 'PROMOTER');
    expect(record.version).toBe(1);
    expect((await readStatus(ORG, 'aboutCompany.ourBusiness')).status).toBe('READY_FOR_REVIEW');
  });

  it('moving backward is a new version, not an overwrite of the history', async () => {
    await writeStatus(ORG, 'aboutCompany.ourBusiness', 'REVIEWED', 'MERCHANT_BANKER');
    await writeStatus(ORG, 'aboutCompany.ourBusiness', 'DRAFT', 'CFO');

    expect((await readStatus(ORG, 'aboutCompany.ourBusiness')).status).toBe('DRAFT');
    expect(await listStatusVersions(ORG, 'aboutCompany.ourBusiness')).toEqual([1, 2]);
    expect((await readStatusVersion(ORG, 'aboutCompany.ourBusiness', 1)).status).toBe('REVIEWED');
  });

  it('keeps different sections apart', async () => {
    await writeStatus(ORG, 'general.forwardLookingStatements', 'LOCKED', 'MERCHANT_BANKER');
    expect((await readStatus(ORG, 'aboutCompany.ourBusiness')).status).toBe('DRAFT');
  });

  it('keeps organizations apart', async () => {
    await writeStatus(ORG, 'aboutCompany.ourBusiness', 'LOCKED', 'MERCHANT_BANKER');
    expect((await readStatus('org_other', 'aboutCompany.ourBusiness')).status).toBe('DRAFT');
  });
});
