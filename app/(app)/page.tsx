import Link from "next/link";
import {
  ClipboardCheck,
  FileText,
  ClipboardList,
  ListChecks,
  ShieldCheck,
} from "lucide-react";
import { auth } from "@clerk/nextjs/server";
import { Button } from "@/components/ui/button";
import { loadIssuer } from "@/lib/issuer";
import { derivedTerms } from "@/lib/document/section";

export const dynamic = "force-dynamic";

/**
 * This page is public (`proxy.ts`) — an anonymous visitor reaches it with no
 * session and no organization, so it must never assume either exists.
 * `documentName` only varies by `offer.documentStage`, which needs a real
 * fact base to read; a visitor with no issuer yet gets the single most
 * common real value instead of a crash.
 */
const DEFAULT_DOCUMENT_NAME = "Draft Red Herring Prospectus";

const STEPS = [
  {
    icon: ClipboardCheck,
    title: "Check eligibility",
    description:
      "Run the free six-step SEBI and exchange pre-check. No account, nothing saved, a cited verdict in minutes.",
  },
  {
    icon: ClipboardList,
    title: "Fill the intake modules",
    description:
      "Ten modules cover company, capital, promoters, financials, legal, approvals and the offer itself — hand each one to whoever holds the facts.",
  },
  {
    icon: FileText,
    title: "Watch the draft build itself",
    description:
      "Every answer feeds the 37-subsection draft prospectus and the gap dashboard, live, section by section.",
  },
  {
    icon: ListChecks,
    title: "Resolve every finding",
    description:
      "Blockers, major and minor gaps each cite the exact clause, what it blocks, and where to fix it.",
  },
  {
    icon: ShieldCheck,
    title: "Certify and export",
    description:
      "A Merchant Banker reviews and certifies the draft; it exports to Word, PDF, a gap workbook and a document vault.",
  },
] as const;

export default async function Home() {
  const { userId, orgId } = await auth();
  const signedInWithOrg = Boolean(userId && orgId);

  const documentName = signedInWithOrg
    ? derivedTerms((await loadIssuer(orgId!)).facts).documentName
    : DEFAULT_DOCUMENT_NAME;

  return (
    <div className="min-h-full bg-background">
      {/* Hero */}
      <div className="relative isolate overflow-hidden border-b border-border">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(to right, var(--border) 1px, transparent 1px), linear-gradient(to bottom, var(--border) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
            maskImage:
              "radial-gradient(ellipse 70% 60% at 50% 0%, black 30%, transparent 90%)",
            WebkitMaskImage:
              "radial-gradient(ellipse 70% 60% at 50% 0%, black 30%, transparent 90%)",
          }}
        />

        <div className="relative mx-auto max-w-3xl px-8 py-24 text-center">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Super Finance
          </p>
          <h1 className="font-heading mt-3 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            SME IPO {documentName}, built from day one
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base text-muted-foreground">
            Super Finance does not replace your merchant banker, legal counsel
            or auditor — it replaces the months spent collecting facts, tracking
            gaps by email, and finding inconsistencies .
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button
              size="lg"
              nativeButton={false}
              render={<Link href="/eligibility" />}
            >
              Check eligibility for free
            </Button>
            {signedInWithOrg ? (
              <Button
                size="lg"
                variant="outline"
                nativeButton={false}
                render={<Link href="/intake" />}
              >
                Continue your draft
              </Button>
            ) : (
              <Button
                size="lg"
                variant="outline"
                nativeButton={false}
                render={<Link href="/sign-up" />}
              >
                Create an account
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Roadmap */}
      <div className="mx-auto max-w-3xl px-8 py-20">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
          How it works
        </p>
        <h2 className="font-heading mt-2 text-2xl font-semibold tracking-tight">
          Five steps from a blank issuer to a filing-ready draft
        </h2>

        <ol className="mt-10 space-y-8">
          {STEPS.map((step, i) => (
            <li key={step.title} className="relative flex gap-5 pb-8 last:pb-0">
              {i < STEPS.length - 1 && (
                <span
                  aria-hidden
                  className="absolute top-11 left-5 h-[calc(100%-1.75rem)] w-px bg-border"
                />
              )}
              <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-card text-sm font-semibold tabular-nums">
                {i + 1}
              </span>
              <div className="pt-1.5">
                <p className="font-heading flex items-center gap-2 text-base font-semibold">
                  <step.icon className="h-4 w-4 text-muted-foreground" />
                  {step.title}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {step.description}
                </p>
              </div>
            </li>
          ))}
        </ol>

        <p className="mt-16 border-t border-border pt-8 text-sm text-muted-foreground">
          Thank you for using Super Finance. We hope it helps you streamline
          your SME IPO process and achieve your financial goals efficiently.
        </p>
      </div>
    </div>
  );
}
