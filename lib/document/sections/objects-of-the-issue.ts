import Decimal from 'decimal.js';
import { formatAs } from '../../facts/money';
import { readNarrative } from '../../store/narrative-store';
import type { FactBase } from '../../facts/schema';
import type { DocumentNode } from '../nodes';
import type { RenderContext, SectionSpec } from '../section';
import { gap, h2, para } from './helpers';

/**
 * OBJECTS OF THE ISSUE — section map #11, 22-32pp observed (far bigger than
 * the original 10-15pp plan), producer "N + C". The computed half — means
 * of finance tables, a deployment schedule, the GCP cap check against
 * R-010 — is not built here; this is the narrative half, the opening
 * paragraph naming the objects and the amount earmarked for each, which
 * every corpus document opens the chapter with before the tables.
 *
 * Scoped the same way as History and Our Business: `offer.objects` already
 * carries description, amount and the GCP/project flags per object — one
 * fact the whole chapter is built from, so drafting the opening is asking
 * the model to describe a structure, not invent one.
 *
 * D68 — structural fix from the S9 register-and-structure audit. Every
 * corpus document checked (Om Galaxy, Maxwell) states the objects as a real
 * NUMBERED LIST, never folded into one prose sentence — the original draft
 * here did the latter ("...as follows: object one amounting to X; object
 * two amounting to Y; and object three amounting to Z"), which reads as a
 * run-on where the corpus reads as a scannable list. Converted to
 * `producer: 'computed'` (matching the shape `basis-for-issue-price.ts` and
 * `risk-factors.ts` already established) so the objects render as a REAL
 * ordered `DocumentNode`, not text a model was asked to punctuate correctly.
 * The drafted narrative is now scoped to the FRAMING sentence only — "the
 * proceeds are proposed to be utilised for the following objects" — the
 * same way the corpus's own prose introduces its list rather than
 * restating it.
 */

function objectsFactSlice(facts: FactBase) {
  const objects = facts.offer.objects;
  const total = objects.reduce((s, o) => s.plus(o.amount), new Decimal(0));
  return {
    companyName: facts.company.name,
    objectCount: objects.length,
    totalAmount: formatAs(total.toFixed(), 'crores'),
  };
}

export const objectsOfTheIssue: SectionSpec = {
  id: 'particulars.objectsOfTheIssue',
  partOf: '11. Objects of the Issue',
  title: 'Objects of the Issue',
  producer: 'computed',
  order: 2100,
  group: 'SECTION - PARTICULARS OF THE OFFER',
  clause: 'ICDR Schedule VI Part A',
  compute: async ({ orgId, facts }: RenderContext): Promise<DocumentNode[]> => {
    const nodes: DocumentNode[] = [h2('Objects of the Issue')];
    const objects = facts.offer.objects;

    if (objects.length === 0) {
      nodes.push(gap('offer.objects', 'The objects of the Issue, with the amount earmarked for each'));
      return nodes;
    }

    const slice = objectsFactSlice(facts);
    const drafted = await readNarrative(orgId, objectsOfTheIssue.id, slice);
    nodes.push(
      para(
        drafted?.text ??
          `We propose that the Net Proceeds of the Fresh Issue shall be utilised towards the following objects (collectively, the "Objects"):`,
      ),
    );

    nodes.push({
      type: 'list',
      ordered: true,
      items: objects.map((o) => [{ text: `${o.description}, amounting to ${formatAs(o.amount, 'crores')}` }]),
    });

    const total = objects.reduce((s, o) => s.plus(o.amount), new Decimal(0));
    nodes.push(
      para(
        `The above Objects aggregate to ${formatAs(total.toFixed(), 'crores')}. The detailed means of finance and deployment schedule for each of the aforesaid Objects are set out in the sections that follow.`,
      ),
    );

    return nodes;
  },
};
