'use server';

import { revalidatePath } from 'next/cache';
import { writeFacts, loadWholeFactBase, resetFactBase, readFactBase } from '@/lib/store/fact-store';
import { findModule } from '@/lib/modules';
import { fieldStatus } from '@/lib/modules/types';
import { vardhman } from '@/lib/seed/vardhman';
import { currentOrgId } from '@/lib/auth/org-context';

/**
 * Per-field autosave.
 *
 * The form saves one field at a time rather than on submit, because M2 alone
 * runs to three or four hours and nobody should lose that to a closed tab.
 * Each save appends a version (see fact-store) — the fact base is never
 * overwritten.
 */
export async function saveField(
  moduleId: string,
  path: string,
  raw: unknown,
): Promise<{ ok: boolean; issues: string[]; version: number }> {
  const orgId = await currentOrgId();
  const module = findModule(moduleId);
  const field = module?.fields.find((f) => f.path === path);

  if (!field) {
    // A path with no field behind it means the form and the registry have
    // diverged. Refusing is better than writing an unaddressable fact.
    return { ok: false, issues: [`Unknown field "${path}"`], version: (await readFactBase(orgId)).version };
  }

  const facts = (await readFactBase(orgId)).facts;
  const status = fieldStatus(field, facts, raw);

  /**
   * An invalid value is still SAVED, and reported.
   *
   * Refusing to store it would lose the issuer's work every time they typed a
   * half-finished date, and would make the gap dashboard lie by omission — a
   * field that is wrong is a different state from a field that is empty, and
   * the document needs to show the difference.
   */
  const written = await writeFacts(orgId, { [path]: raw }, 'issuer');

  /**
   * 'layout' revalidates the nested module pages too, not just /intake itself.
   * Without it the live consistency banner on /intake/m2 — the one that says
   * the register reaches 99.4% — would only appear after a manual reload, and
   * a consistency check the issuer has to go looking for is not live.
   */
  revalidatePath('/intake', 'layout');
  revalidatePath('/document', 'layout');

  return { ok: status.issues.length === 0, issues: status.issues, version: written.version };
}

/**
 * "Load demo data" — fills every module with the Vardhman demo issuer's
 * answers in one write, for a demo that shows the tool rather than someone
 * typing into it live. A normal write (see `loadWholeFactBase`): append-only,
 * so nothing already saved is lost, and every field stays editable exactly
 * as if a person had typed each one.
 */
export async function loadDemoData(): Promise<{ ok: boolean; version: number; error?: string }> {
  const orgId = await currentOrgId();
  const written = await loadWholeFactBase(orgId, vardhman, 'demo');
  revalidatePath('/intake', 'layout');
  revalidatePath('/document', 'layout');
  return { ok: true, version: written.version };
}

/**
 * "Reset" — clears every module back to unanswered, symmetric with "Load
 * demo data". Nothing is deleted: this appends a new empty version, so the
 * data just cleared is still on disk under its old version number.
 */
export async function resetIntakeData(): Promise<{ ok: boolean; version: number; error?: string }> {
  const orgId = await currentOrgId();
  const written = await resetFactBase(orgId, 'reset');
  revalidatePath('/intake', 'layout');
  revalidatePath('/document', 'layout');
  return { ok: true, version: written.version };
}
