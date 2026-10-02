import type { ProvenanceMap } from './facts/provenance';
import type { FactBase } from './facts/schema';
import { withAnswers } from './seed/empty';
import { vardhman } from './seed/vardhman';
import { readFactBase } from './store/fact-store';

/**
 * The issuer the app is currently working on, assembled the one way.
 *
 * The preview page and the DOCX export both need "the facts as they stand",
 * and if each built them separately they would eventually disagree — one
 * showing the demo issuer while the other exports a real one, or the reverse.
 * A document a banker downloads must be the document they were just looking
 * at, so there is exactly one place that decides what that is.
 */
export interface LoadedIssuer {
  facts: FactBase;
  /** True while nothing has been typed and the demo seed is showing. */
  isDemo: boolean;
  /** Fact-base version on disk; 0 for the demo. */
  version: number;
  /** Who supplied each fact and when. Empty for the demo seed. */
  provenance: ProvenanceMap;
}

/**
 * The issuer's own answers if they have started, the demo seed if not.
 *
 * Once a real issuer has typed anything, their answers are laid over an
 * EMPTY fact base rather than over the seed. Merging onto the seed would
 * produce a document that reads as complete while carrying Vardhman's
 * figures in every unanswered place — D21's finding as a product decision
 * (D33). Unanswered facts render as gaps instead, which is what the gap list
 * is for.
 */
export async function loadIssuer(orgId: string): Promise<LoadedIssuer> {
  const stored = await readFactBase(orgId);
  const isDemo = stored.version === 0;
  return {
    facts: isDemo ? vardhman : withAnswers(stored.facts),
    isDemo,
    version: stored.version,
    provenance: stored.provenance,
  };
}
