import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { appendAudit, readAuditLog, createFakeAuditLog, __setAuditLogForTests } from './audit-log';

const ORG = 'org_test1';

describe('the audit log', () => {
  beforeEach(() => {
    __setAuditLogForTests(createFakeAuditLog());
  });

  afterEach(() => {
    __setAuditLogForTests(null);
  });

  it('is empty until something is logged', async () => {
    expect(await readAuditLog(ORG)).toEqual([]);
  });

  it('appends without overwriting, and stamps an id and a timestamp', async () => {
    const first = await appendAudit(ORG, { actor: 'CFO', action: 'section-status', detail: 'A -> B' });
    const second = await appendAudit(ORG, { actor: 'MERCHANT_BANKER', action: 'certify' });

    expect(first.id).not.toBe(second.id);
    expect(first.at).toBeTruthy();

    const log = await readAuditLog(ORG);
    expect(log).toHaveLength(2);
  });

  it('reads newest first', async () => {
    await appendAudit(ORG, { actor: 'PROMOTER', action: 'comment', detail: 'first' });
    await appendAudit(ORG, { actor: 'PROMOTER', action: 'comment', detail: 'second' });

    const log = await readAuditLog(ORG);
    expect(log[0].detail).toBe('second');
    expect(log[1].detail).toBe('first');
  });

  it('carries the real signed-in identity alongside the cosmetic role', async () => {
    await appendAudit(ORG, { actor: 'CFO', actorName: 'Jane Doe', actorEmail: 'jane@example.com', action: 'certify' });
    const [entry] = await readAuditLog(ORG);
    expect(entry.actorName).toBe('Jane Doe');
    expect(entry.actorEmail).toBe('jane@example.com');
  });

  it('keeps organizations apart', async () => {
    await appendAudit(ORG, { actor: 'CFO', action: 'certify' });
    await appendAudit('org_other', { actor: 'CFO', action: 'certify' });
    expect(await readAuditLog(ORG)).toHaveLength(1);
    expect(await readAuditLog('org_other')).toHaveLength(1);
  });
});
