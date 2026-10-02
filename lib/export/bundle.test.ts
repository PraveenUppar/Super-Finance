import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { assemble } from './bundle';
import { certify } from '../store/certification-store';
import { createFakeVersionedTable, __setVersionedTableForTests } from '../store/versioned-table';

const ORG = 'org_test1';

/**
 * S12: `assemble()` is the one place every export route reads `certified`
 * from (`app/export/docx/route.ts`, `pdf/route.ts`, `buildVault`). This
 * confirms it actually reflects the certification store rather than the
 * hardcoded `false` it used to be — a full DOCX render isn't needed to prove
 * that wiring; `docx.test.ts` already covers what the flag does once it
 * reaches `renderDocx`.
 */
describe('assemble()', () => {
  beforeEach(() => {
    __setVersionedTableForTests(createFakeVersionedTable());
  });

  afterEach(() => {
    __setVersionedTableForTests(null);
  });

  it('is not certified by default', async () => {
    expect((await assemble(ORG)).certified).toBe(false);
  });

  it('reflects a real certification', async () => {
    await certify(ORG, 'MERCHANT_BANKER');
    expect((await assemble(ORG)).certified).toBe(true);
  });
});
