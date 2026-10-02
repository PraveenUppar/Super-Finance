import { ReviewSectionCard } from '@/components/review-section-card';
import { CertificationBanner } from '@/components/certification-banner';
import { renderSections } from '@/lib/document/section';
import { sectionRegistry } from '@/lib/document/sections';
import { loadIssuer } from '@/lib/issuer';
import { readStatus } from '@/lib/store/section-status-store';
import { readThread } from '@/lib/store/comment-store';
import { readCertification } from '@/lib/store/certification-store';
import { currentOrgId } from '@/lib/auth/org-context';

export const dynamic = 'force-dynamic';

/**
 * S12's review hub: every rendered section with its status — the general,
 * cross-role counterpart to `/review/risks` (D58's narrow, S10-specific
 * dismissal review, built first and kept as its own page rather than
 * folded in here, per the handoff's own note on the overlap).
 *
 * The certification action and the per-section comment thread both lived
 * here too (D35's "lift the UNSIGNED DRAFT notice" control; S12's thread) —
 * both restored below: `CertificationBanner` and `SectionComments` were
 * already fully built, with nothing on screen calling either one.
 */
export default async function ReviewPage() {
  const orgId = await currentOrgId();
  const { facts } = await loadIssuer(orgId);
  const sections = await renderSections(sectionRegistry, { orgId, facts });

  // Fetched up front, not inside the render loop below — a Server Component
  // can await before returning JSX, but not partway through building it.
  const statuses = new Map(
    await Promise.all(sections.map(async (s) => [s.id, await readStatus(orgId, s.id)] as const)),
  );
  const threads = new Map(
    await Promise.all(sections.map(async (s) => [s.id, await readThread(orgId, s.id)] as const)),
  );
  const certification = await readCertification(orgId);

  const groups = new Map<string, typeof sections>();
  for (const section of sections) {
    const list = groups.get(section.group) ?? [];
    list.push(section);
    groups.set(section.group, list);
  }

  return (
    <div className="mx-auto max-w-4xl px-8 py-12">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
        Review
      </p>
      <h1 className="font-heading mt-2 text-2xl font-semibold tracking-tight">
        {facts.company.name}
      </h1>

      <div className="mt-6">
        <CertificationBanner data={certification} />
      </div>

      <div className="mt-8 space-y-6">
        {[...groups.entries()].map(([group, groupSections]) => (
          <section key={group} className="rounded-lg border border-border bg-card p-5 shadow-sm">
            <h2 className="font-heading text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {group}
              <span className="ml-1.5 font-normal normal-case text-muted-foreground/70">
                &middot; {groupSections.length}
              </span>
            </h2>
            <ul className="mt-2 divide-y divide-border">
              {groupSections.map((section) => {
                const status = statuses.get(section.id)!;
                const comments = threads.get(section.id) ?? [];
                return (
                  <ReviewSectionCard
                    key={section.id}
                    section={{
                      id: section.id,
                      title: section.title,
                      status: status.status,
                      comments,
                    }}
                  />
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
