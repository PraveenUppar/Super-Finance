import { DocumentPager } from '@/components/document-pager';
import { renderSections, derivedTerms } from '@/lib/document/section';
import { sectionRegistry } from '@/lib/document/sections';
import { collectPlaceholders } from '@/lib/document/nodes';
import { gapAnchor, sectionAnchor } from '@/lib/anchors';
import { loadIssuer } from '@/lib/issuer';
import { currentOrgId } from '@/lib/auth/org-context';

/**
 * The document itself — what does the draft actually say.
 *
 * Deliberately just that. The gap report (is it ready to file) and export
 * (give me the file) used to live on this same page; both moved to their
 * own places so this page answers one question, not three.
 */

export const dynamic = 'force-dynamic';

export default async function DocumentPage() {
  // One loader for the preview and the export, so they cannot show
  // different issuers. The demo-vs-real decision lives in lib/issuer.ts.
  const orgId = await currentOrgId();
  const { facts } = await loadIssuer(orgId);
  const terms = derivedTerms(facts);
  const sections = await renderSections(sectionRegistry, { orgId, facts });

  /**
   * Which reading-page (section index) owns each anchor a link elsewhere
   * might jump to — a "Holds up" link from the gap report, or a placeholder
   * pointing back here. Mirrors `gapAnchorKeys`'s own "first occurrence
   * wins" rule so a gap repeated across sections resolves to the same page
   * `DocumentView` would highlight it on.
   */
  const anchorToPage: Record<string, number> = {};
  const seenFactPaths = new Set<string>();
  sections.forEach((section, i) => {
    anchorToPage[sectionAnchor(section.id)] = i;
    for (const placeholder of collectPlaceholders(section.nodes)) {
      if (seenFactPaths.has(placeholder.factPath)) continue;
      seenFactPaths.add(placeholder.factPath);
      anchorToPage[gapAnchor(placeholder.factPath)] = i;
    }
  });

  return (
    <div className="mx-auto max-w-4xl px-8 py-12">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
        {terms.documentName}
      </p>
      <h1 className="font-heading mt-2 text-2xl font-semibold tracking-tight">
        {facts.company.name}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {terms.exchangeName} &middot;{' '}
        {facts.offer.issueType === 'BOOK_BUILT' ? 'Book Built' : 'Fixed Price'} {terms.issueWord}
      </p>
      <div className="mt-8">
        <DocumentPager sections={sections} anchorToPage={anchorToPage} />
      </div>
    </div>
  );
}
