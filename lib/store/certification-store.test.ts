import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readCertification, certify, revokeCertification, listCertificationVersions } from './certification-store';
import { createFakeVersionedTable, __setVersionedTableForTests } from './versioned-table';

const ORG = 'org_test1';

describe('the certification store', () => {
  beforeEach(() => {
    __setVersionedTableForTests(createFakeVersionedTable());
  });

  afterEach(() => {
    __setVersionedTableForTests(null);
  });

  it('defaults to not certified', async () => {
    const record = await readCertification(ORG);
    expect(record.certified).toBe(false);
    expect(record.certifiedBy).toBeNull();
    expect(record.version).toBe(0);
  });

  it('certifying records who and when', async () => {
    const record = await certify(ORG, 'MERCHANT_BANKER');
    expect(record.certified).toBe(true);
    expect(record.certifiedBy).toBe('MERCHANT_BANKER');
    expect(record.certifiedAt).toBeTruthy();
    expect((await readCertification(ORG)).certified).toBe(true);
  });

  it('revoking is a new version, not a deletion of the certification history', async () => {
    await certify(ORG, 'MERCHANT_BANKER');
    await revokeCertification(ORG, 'MERCHANT_BANKER');

    expect((await readCertification(ORG)).certified).toBe(false);
    expect(await listCertificationVersions(ORG)).toEqual([1, 2]);
  });

  it('keeps organizations apart', async () => {
    await certify(ORG, 'MERCHANT_BANKER');
    expect((await readCertification('org_other')).certified).toBe(false);
  });
});
