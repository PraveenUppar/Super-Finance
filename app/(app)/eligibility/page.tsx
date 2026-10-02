'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Building2,
  FileText,
  Coins,
  TrendingUp,
  ShieldAlert,
  ShieldCheck,
  Check,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatAs, money } from '@/lib/facts/money';
import { runPreCheck, type PreCheckInput, type PreCheckYear } from '@/lib/rules/precheck';
import type { Exchange } from '@/lib/facts/schema';

/**
 * The standalone eligibility pre-check.
 *
 * No signup, no document, no merchant banker — a promoter answers what they
 * already know and gets a cited verdict. Today the alternative is paying an
 * intermediary for a preliminary assessment, or far more often never finding
 * out at all.
 *
 * Six steps, and every question says why it is being asked. Someone who has
 * never done this does not know what a "bid lot" is, and should not have to
 * before learning whether they qualify at all.
 *
 * Questions that only one exchange asks are only shown for that exchange. The
 * two rulebooks diverge more than people expect — BSE looks at the company's
 * own rejected applications, NSE at the merchant banker's returned drafts —
 * and putting both to everyone would ask half the audience about something
 * that does not govern them.
 */

/**
 * These fields are plain text inputs re-parsed on every keystroke (via the
 * `input` useMemo below), so a value can be genuinely invalid mid-typing —
 * a stray extra "." or "-" — not just empty. `money()` throws on that by
 * design (it's the shared, validated parser real fact-base writes rely on),
 * so a live preview must not call it unguarded: one bad keystroke would
 * throw inside a render-phase useMemo, with no error boundary to catch it,
 * crashing the whole page. Falls back to the last-known-good reading of 0
 * until the user finishes typing a valid number.
 */
const safeMoney = (v: string, unit: Parameters<typeof money>[1]) => {
  try {
    return money(v || '0', unit);
  } catch {
    return money('0', unit);
  }
};

const cr = (v: string) => safeMoney(v, 'crores');

interface YearForm {
  yearEnding: string;
  profitBeforeTax: string;
  financeCosts: string;
  depreciation: string;
  otherIncome: string;
  netWorth: string;
  totalBorrowings: string;
  shareholdersEquity: string;
  cashFlowFromOperations: string;
  netPurchaseOfFixedAssets: string;
  netBorrowings: string;
  interestPaidNetOfTax: string;
}

const emptyYear = (yearEnding: number): YearForm => ({
  yearEnding: String(yearEnding),
  profitBeforeTax: '',
  financeCosts: '',
  depreciation: '',
  otherIncome: '',
  netWorth: '',
  totalBorrowings: '',
  shareholdersEquity: '',
  cashFlowFromOperations: '',
  netPurchaseOfFixedAssets: '',
  netBorrowings: '',
  interestPaidNetOfTax: '',
});

/**
 * Demo defaults — the same Vardhman Precision Components figures used as
 * the seed issuer everywhere else in the app (`lib/seed/vardhman.ts`),
 * hand-copied rather than imported so this standalone pre-check stays
 * self-contained (no account, nothing saved, works with no fact base at
 * all). Every field stays editable; this only saves re-typing for a demo
 * or a quick end-to-end check.
 */
const demoYear = (year: { yearEnding: number } & Partial<Omit<YearForm, 'yearEnding'>>): YearForm => ({
  ...emptyYear(year.yearEnding),
  ...year,
  yearEnding: String(year.yearEnding),
});

const DEMO_YEARS: YearForm[] = [
  demoYear({
    yearEnding: 2026,
    profitBeforeTax: '4.85',
    financeCosts: '0.78',
    depreciation: '1.12',
    otherIncome: '0.35',
    netWorth: '19.40',
    totalBorrowings: '8.60',
    shareholdersEquity: '19.40',
    cashFlowFromOperations: '5.20',
    netPurchaseOfFixedAssets: '3.80',
    netBorrowings: '1.40',
    interestPaidNetOfTax: '0.58',
  }),
  demoYear({
    yearEnding: 2025,
    profitBeforeTax: '3.42',
    financeCosts: '0.64',
    depreciation: '0.98',
    otherIncome: '0.28',
    netWorth: '14.20',
    totalBorrowings: '7.20',
    shareholdersEquity: '14.20',
    cashFlowFromOperations: '3.10',
    netPurchaseOfFixedAssets: '2.40',
    netBorrowings: '0.90',
    interestPaidNetOfTax: '0.48',
  }),
  demoYear({
    yearEnding: 2024,
    profitBeforeTax: '1.48',
    financeCosts: '0.52',
    depreciation: '0.81',
    otherIncome: '0.19',
    netWorth: '9.80',
    totalBorrowings: '6.10',
    shareholdersEquity: '9.80',
    cashFlowFromOperations: '2.05',
    netPurchaseOfFixedAssets: '1.60',
    netBorrowings: '0.70',
    interestPaidNetOfTax: '0.39',
  }),
];

interface StepMeta {
  label: string;
  icon: LucideIcon;
}

const STEPS: StepMeta[] = [
  { label: 'Listing', icon: Building2 },
  { label: 'Company', icon: FileText },
  { label: 'Capital', icon: Coins },
  { label: 'Financials', icon: TrendingUp },
  { label: 'Declarations', icon: ShieldAlert },
  { label: 'Exchange checks', icon: ShieldCheck },
];

function Field({
  label,
  why,
  children,
}: {
  label: string;
  why?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-foreground">{label}</span>
      {children}
      {why && <span className="mt-1.5 block text-xs leading-relaxed text-muted-foreground">{why}</span>}
    </label>
  );
}

const inputClass =
  'mt-1.5 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm tabular-nums shadow-xs outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30';

/**
 * <option> popups are rendered by the OS/browser as a native layer that
 * ignores Tailwind classes and mostly ignores `color-scheme` too on some
 * platforms — an explicit inline style is the one thing every browser
 * reliably reads for them, so this can't be a className.
 */
const optionStyle = { backgroundColor: 'var(--popover)', color: 'var(--popover-foreground)' };

function YesNo({
  label,
  why,
  value,
  onChange,
}: {
  label: string;
  why?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-6 border-b border-border py-4 last:border-0">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        {why && <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{why}</p>}
      </div>
      <div className="flex shrink-0 gap-1 rounded-md border border-border bg-muted/40 p-0.5">
        {[false, true].map((v) => (
          <button
            key={String(v)}
            type="button"
            onClick={() => onChange(v)}
            className={`rounded px-3 py-1 text-sm font-medium transition-colors ${
              value === v
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {v ? 'Yes' : 'No'}
          </button>
        ))}
      </div>
    </div>
  );
}

/** The horizontal step roadmap — completed, current and upcoming states, each cell drawing its own connecting half-lines so the grid never misaligns. */
function StepRoadmap({ current }: { current: number }) {
  return (
    <div className="grid grid-cols-6 items-start">
      {STEPS.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={s.label} className="relative flex flex-col items-center gap-2 px-1 text-center">
            {i > 0 && (
              <span aria-hidden className="absolute top-4 right-1/2 h-px w-1/2 bg-border" />
            )}
            {i < STEPS.length - 1 && (
              <span aria-hidden className="absolute top-4 left-1/2 h-px w-1/2 bg-border" />
            )}
            <span
              className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold transition-colors ${
                done || active
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-background text-muted-foreground'
              }`}
            >
              {done ? <Check className="h-4 w-4" /> : i + 1}
            </span>
            <span
              className={`text-[11px] font-medium ${active ? 'text-foreground' : 'text-muted-foreground'}`}
            >
              {s.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function EligibilityPreCheck() {
  const [step, setStep] = useState(0);
  const [submitted, setSubmitted] = useState(false);

  const [exchange, setExchange] = useState<Exchange>('BSE_SME');
  const [isPublicLimited, setIsPublicLimited] = useState(true);
  const [dateOfIncorporation, setDateOfIncorporation] = useState('2016-04-12');
  const [faceValue, setFaceValue] = useState('10');
  const [paidUpShares, setPaidUpShares] = useState('12000000');
  const [authorisedShares, setAuthorisedShares] = useState('20000000');
  const [freshIssueShares, setFreshIssueShares] = useState('4500000');
  const [years, setYears] = useState<YearForm[]>(DEMO_YEARS);
  const [debarred, setDebarred] = useState(false);
  const [defaulter, setDefaulter] = useState(false);
  const [fugitive, setFugitive] = useState(false);
  const [convertibles, setConvertibles] = useState(false);
  const [partlyPaid, setPartlyPaid] = useState(false);

  // Exchange criteria answerable on day one (E-08 to E-18, N-06 to N-11).
  const [conversionDate, setConversionDate] = useState('2025-02-18');
  const [lastNameChangeDate, setLastNameChangeDate] = useState('');
  const [nclt, setNclt] = useState(false);
  const [windingUp, setWindingUp] = useState(false);
  const [bifr, setBifr] = useState(false);
  const [delisted, setDelisted] = useState(false);
  const [controlChanged, setControlChanged] = useState(false);
  const [debtDefaults, setDebtDefaults] = useState(false);
  const [applicationRejectedDate, setApplicationRejectedDate] = useState('');
  const [promotingCompanyIbc, setPromotingCompanyIbc] = useState(false);
  const [tradingSuspended, setTradingSuspended] = useState(false);
  const [firmType, setFirmType] = useState<'NONE' | 'PROPRIETORSHIP' | 'PARTNERSHIP' | 'LLP'>('NONE');
  const [firmConversionDate, setFirmConversionDate] = useState('');
  const [promoterChangeDate, setPromoterChangeDate] = useState('');
  const [sebiActionDate, setSebiActionDate] = useState('');
  const [newNameRevenueShare, setNewNameRevenueShare] = useState('');

  const needsCashFlow = exchange === 'NSE_EMERGE';
  const isBSE = exchange === 'BSE_SME';

  const input: PreCheckInput = useMemo(
    () => ({
      exchange,
      isPublicLimited,
      dateOfIncorporation: dateOfIncorporation || '2000-01-01',
      faceValue: safeMoney(faceValue || '10', 'rupees'),
      paidUpShares: Number(paidUpShares) || 0,
      authorisedShares: Number(authorisedShares) || 0,
      intendedFreshIssueShares: Number(freshIssueShares) || 0,
      years: years.map(
        (y): PreCheckYear => ({
          yearEnding: Number(y.yearEnding),
          profitBeforeTax: cr(y.profitBeforeTax),
          financeCosts: cr(y.financeCosts),
          depreciationAndAmortisation: cr(y.depreciation),
          otherIncome: cr(y.otherIncome),
          netWorth: cr(y.netWorth),
          totalBorrowings: cr(y.totalBorrowings),
          shareholdersEquity: cr(y.shareholdersEquity),
          ...(needsCashFlow
            ? {
                cashFlowFromOperations: cr(y.cashFlowFromOperations),
                netPurchaseOfFixedAssets: cr(y.netPurchaseOfFixedAssets),
                netBorrowings: cr(y.netBorrowings),
                interestPaidNetOfTax: cr(y.interestPaidNetOfTax),
              }
            : {}),
        }),
      ),
      anyDebarredBySebi: debarred,
      anyWilfulDefaulterOrFraudulentBorrower: defaulter,
      anyFugitiveEconomicOffender: fugitive,
      hasOutstandingConvertibles: convertibles,
      hasPartlyPaidShares: partlyPaid,

      referredToNCLT: nclt,
      windingUpPetitionAdmitted: windingUp,
      referredToBIFR: bifr,
      anyAssociatedWithDelistedCompany: delisted,

      // Blank means "never", which is what the rules read as null.
      conversionToPublicDate: conversionDate || null,
      lastNameChangeDate: lastNameChangeDate || null,
      controlChangedInPastYear: controlChanged,
      exchangeApplicationRejectedSince: applicationRejectedDate || null,
      pendingDebtSecurityDefaults: debtDefaults,

      ibcProceedingsAgainstPromotingCompanies: promotingCompanyIbc,
      tradingSuspendedForPromoterCompanies: tradingSuspended,

      convertedFromFirmType: firmType,
      conversionFromFirmDate: firmConversionDate || null,
      majorityPromoterChangeDate: promoterChangeDate || null,
      sebiActionAgainstDirectorsSince: sebiActionDate || null,
      revenueShareFromNewNameActivity:
        newNameRevenueShare === '' ? null : Number(newNameRevenueShare),
    }),
    [exchange, isPublicLimited, dateOfIncorporation, faceValue, paidUpShares, authorisedShares, freshIssueShares, years, debarred, defaulter, fugitive, convertibles, partlyPaid, needsCashFlow, nclt, windingUp, bifr, delisted, conversionDate, lastNameChangeDate, controlChanged, applicationRejectedDate, debtDefaults, promotingCompanyIbc, tradingSuspended, firmType, firmConversionDate, promoterChangeDate, sebiActionDate, newNameRevenueShare],
  );

  const result = useMemo(() => runPreCheck(input), [input]);

  const setYear = (i: number, patch: Partial<YearForm>) =>
    setYears((ys) => ys.map((y, j) => (i === j ? { ...y, ...patch } : y)));

  if (submitted) {
    return (
      <div className="mx-auto max-w-3xl px-8 py-12">
        <div
          className={`rounded-lg border p-6 ${
            result.eligible
              ? 'border-emerald-900/60 bg-emerald-950/30'
              : 'border-red-900/60 bg-red-950/30'
          }`}
        >
          <h1 className="font-heading flex items-center gap-2.5 text-2xl font-semibold">
            {result.eligible ? (
              <CheckCircle2 className="h-6 w-6 text-emerald-500" />
            ) : (
              <XCircle className="h-6 w-6 text-red-500" />
            )}
            {result.eligible ? 'Eligible, on what you have told us' : 'Not eligible yet'}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {result.eligible
              ? `Nothing here stops you listing on ${exchange === 'BSE_SME' ? 'BSE SME' : 'NSE Emerge'}. A full assessment covers more ground once you have engaged a merchant banker.`
              : `${result.summary.blockers} thing${result.summary.blockers === 1 ? '' : 's'} would stop the exchange accepting this today. Each is fixable, and each is explained below.`}
          </p>

          <dl className="mt-5 flex flex-wrap gap-8 text-sm">
            <div>
              <dt className="text-muted-foreground">Post-issue capital</dt>
              <dd className="mt-0.5 font-semibold tabular-nums">
                {formatAs(result.postIssueCapital, 'crores')}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Checks passed</dt>
              <dd className="mt-0.5 font-semibold tabular-nums">
                {result.summary.passed} of {result.summary.passed + result.findings.length}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Typical time to listing</dt>
              <dd className="mt-0.5 font-semibold tabular-nums">
                {result.estimatedMonths} to {result.estimatedMonths + 3} months
              </dd>
            </div>
          </dl>

          {result.eligible && (
            <Button className="mt-5" nativeButton={false} render={<Link href="/intake" />}>
              Continue to documentation
            </Button>
          )}
        </div>

        {result.findings.length > 0 && (
          <ul className="mt-6 space-y-4">
            {result.findings.map((f) => (
              <li
                key={f.ruleId}
                className="rounded-lg border border-border bg-card p-4"
              >
                <p className="flex items-center gap-2 font-medium">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
                  {f.title}
                </p>
                <pre className="mt-2 whitespace-pre-wrap font-sans text-sm leading-relaxed text-muted-foreground">
                  {f.detail}
                </pre>
                <p className="mt-2 text-xs text-muted-foreground">Requirement: {f.clause}</p>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-8 text-xs text-muted-foreground">
          This is an indicative check against the eligibility conditions a promoter can answer
          without a merchant banker. It is not advice, and it does not replace the due diligence and
          certification a merchant banker must carry out before filing.
        </p>

        <Button variant="outline" className="mt-6" onClick={() => setSubmitted(false)}>
          Change my answers
        </Button>
      </div>
    );
  }

  const current = STEPS[step];

  return (
    <div className="mx-auto max-w-3xl px-8 py-12">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
        Eligibility pre-check
      </p>
      <h1 className="font-heading mt-2 text-2xl font-semibold tracking-tight">
        Can my company do an SME IPO?
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Six short steps. Nothing is saved and you do not need an account.
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Pre-filled with a demo issuer&apos;s figures — every field is editable.
      </p>

      <div className="mt-8">
        <StepRoadmap current={step} />
      </div>

      <div className="mt-8 rounded-lg border border-border bg-card p-6">
        <div className="mb-6 flex items-center gap-3 border-b border-border pb-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted">
            <current.icon className="h-4.5 w-4.5 text-foreground" />
          </span>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Step {step + 1} of {STEPS.length}
            </p>
            <h2 className="font-heading text-lg font-semibold">{current.label}</h2>
          </div>
        </div>

        <div className="space-y-5">
          {step === 0 && (
            <Field
              label="Which exchange are you aiming for?"
              why="The two platforms apply different financial tests. BSE SME looks at leverage and net worth; NSE Emerge looks at free cash flow."
            >
              <select
                className={inputClass}
                value={exchange}
                onChange={(e) => setExchange(e.target.value as Exchange)}
              >
                <option style={optionStyle} value="BSE_SME">BSE SME</option>
                <option style={optionStyle} value="NSE_EMERGE">NSE Emerge</option>
              </select>
            </Field>
          )}

          {step === 1 && (
            <>
              <Field
                label="Date of incorporation"
                why="Both exchanges require a track record of at least three years."
              >
                <input
                  type="date"
                  className={inputClass}
                  value={dateOfIncorporation}
                  onChange={(e) => setDateOfIncorporation(e.target.value)}
                />
              </Field>
              <YesNo
                label="Is the company already a public limited company?"
                why="Only a public limited company can make a public issue. Converting takes 45 to 60 days, so it is worth knowing early."
                value={isPublicLimited}
                onChange={setIsPublicLimited}
              />
              {isPublicLimited && isBSE && (
                <Field
                  label="Date of conversion to public limited (if known)"
                  why="So the conversion is not mistaken for an ordinary change of name. It changes Private Limited to Limited without changing what the company does, so it does not trigger the revenue test below."
                >
                  <input
                    type="date"
                    className={inputClass}
                    value={conversionDate}
                    onChange={(e) => setConversionDate(e.target.value)}
                  />
                </Field>
              )}
              {isBSE && (
                <Field
                  label="Date of the most recent change of name (leave blank if none)"
                  why="Not counting the conversion above, which changes the name but not the activity it indicates. A change inside the year is not a bar — it triggers a revenue test."
                >
                  <input
                    type="date"
                    className={inputClass}
                    value={lastNameChangeDate}
                    onChange={(e) => setLastNameChangeDate(e.target.value)}
                  />
                </Field>
              )}
              {isBSE && lastNameChangeDate !== '' && (
                <Field
                  label="Percentage of last year's revenue from the activity your new name indicates"
                  why="At least 50% of the preceding full year's restated revenue must have come from the activity the new name describes. Below that, the issue waits until the change is a year old."
                >
                  <input
                    className={inputClass}
                    value={newNameRevenueShare}
                    onChange={(e) => setNewNameRevenueShare(e.target.value)}
                    placeholder="e.g. 72"
                  />
                </Field>
              )}

              <Field
                label="Was the business a proprietorship, partnership or LLP before it became a company?"
                why="Regulation 229(4) requires a converted firm to have existed as a company for one FULL financial year — 1 April to 31 March — before filing. It catches people out because the business is old while the company is new."
              >
                <select
                  className={inputClass}
                  value={firmType}
                  onChange={(e) => setFirmType(e.target.value as typeof firmType)}
                >
                  <option style={optionStyle} value="NONE">No, it was always a company</option>
                  <option style={optionStyle} value="PROPRIETORSHIP">Yes, a proprietorship</option>
                  <option style={optionStyle} value="PARTNERSHIP">Yes, a partnership firm</option>
                  <option style={optionStyle} value="LLP">Yes, an LLP</option>
                </select>
              </Field>
              {firmType !== 'NONE' && (
                <Field label="Date the company came into existence on that conversion">
                  <input
                    type="date"
                    className={inputClass}
                    value={firmConversionDate}
                    onChange={(e) => setFirmConversionDate(e.target.value)}
                  />
                </Field>
              )}
            </>
          )}

          {step === 2 && (
            <>
              <Field label="Face value per share (Rs)">
                <input className={inputClass} value={faceValue} onChange={(e) => setFaceValue(e.target.value)} />
              </Field>
              <Field label="Shares issued today" why="Your current paid-up equity shares, before the IPO.">
                <input className={inputClass} value={paidUpShares} onChange={(e) => setPaidUpShares(e.target.value)} />
              </Field>
              <Field
                label="Authorised shares"
                why="From your Memorandum of Association. If the issue would push you past this, you need a shareholder resolution first."
              >
                <input className={inputClass} value={authorisedShares} onChange={(e) => setAuthorisedShares(e.target.value)} />
              </Field>
              <Field
                label="New shares you intend to issue"
                why="This decides two things at once: whether post-issue capital stays under Rs 25 crore, and whether the issue reaches the 25% minimum."
              >
                <input className={inputClass} value={freshIssueShares} onChange={(e) => setFreshIssueShares(e.target.value)} />
              </Field>
            </>
          )}

          {step === 3 && (
            <>
              <p className="text-sm text-muted-foreground">
                Three financial years, most recent first, in Rs crore. These come straight off your
                audited accounts.
              </p>
              {years.map((y, i) => (
                <fieldset key={i} className="rounded-md border border-border p-4">
                  <legend className="font-heading px-1 text-sm font-medium">FY {y.yearEnding}</legend>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {(
                      [
                        ['profitBeforeTax', 'Profit before tax'],
                        ['financeCosts', 'Finance costs'],
                        ['depreciation', 'Depreciation'],
                        ['otherIncome', 'Other income'],
                        ['netWorth', 'Net worth'],
                        ['totalBorrowings', 'Total borrowings'],
                        ['shareholdersEquity', "Shareholders' equity"],
                        ...(needsCashFlow
                          ? ([
                              ['cashFlowFromOperations', 'Cash from operations'],
                              ['netPurchaseOfFixedAssets', 'Fixed asset purchases'],
                              ['netBorrowings', 'Net borrowings'],
                              ['interestPaidNetOfTax', 'Interest paid, net of tax'],
                            ] as const)
                          : []),
                      ] as const
                    ).map(([key, label]) => (
                      <label key={key} className="block">
                        <span className="text-xs text-muted-foreground">{label}</span>
                        <input
                          className={inputClass}
                          value={y[key as keyof YearForm]}
                          onChange={(e) => setYear(i, { [key]: e.target.value } as Partial<YearForm>)}
                        />
                      </label>
                    ))}
                  </div>
                </fieldset>
              ))}
            </>
          )}

          {step === 4 && (
            <>
              <p className="text-sm text-muted-foreground">
                These are absolute bars under Regulation 228. Answering yes to any one of them stops
                the issue until it is resolved.
              </p>
              <YesNo
                label="Is any promoter or director debarred from the capital markets by SEBI?"
                value={debarred}
                onChange={setDebarred}
              />
              <YesNo
                label="Is the company, any promoter or any director a wilful defaulter or fraudulent borrower?"
                value={defaulter}
                onChange={setDefaulter}
              />
              <YesNo
                label="Is any promoter or director a fugitive economic offender?"
                value={fugitive}
                onChange={setFugitive}
              />
              <YesNo
                label="Are there outstanding convertible securities, or rights to receive shares?"
                why="These must be converted or extinguished before filing, which can take months."
                value={convertibles}
                onChange={setConvertibles}
              />
              <YesNo
                label="Are any existing shares only partly paid up?"
                value={partlyPaid}
                onChange={setPartlyPaid}
              />
            </>
          )}

          {step === 5 && (
            <>
              <p className="text-sm text-muted-foreground">
                {isBSE ? 'BSE SME' : 'NSE Emerge'} applies its own conditions on top of SEBI&apos;s.
                These are the ones you can answer today; the rest need your accounts or a merchant
                banker.
              </p>
              <YesNo
                label="Has the company been referred to the NCLT under the Insolvency and Bankruptcy Code?"
                value={nclt}
                onChange={setNclt}
              />
              <YesNo
                label="Has a winding-up petition been admitted, or a liquidator appointed?"
                value={windingUp}
                onChange={setWindingUp}
              />
              <YesNo
                label="Has the company been referred to BIFR?"
                value={bifr}
                onChange={setBifr}
              />
              <YesNo
                label="Is any promoter or non-independent director also a promoter or director of a compulsorily delisted company?"
                why="Independent directorships do not count — the criterion reads &quot;other than independent directors&quot; at both exchanges."
                value={delisted}
                onChange={setDelisted}
              />
              <Field
                label="If promoters changed completely, or new promoters took more than 50%, when? (blank if never)"
                why="Regulation 229(5) allows filing only one year after that change. It is a regulation, not an exchange rule, so it applies at both platforms."
              >
                <input
                  type="date"
                  className={inputClass}
                  value={promoterChangeDate}
                  onChange={(e) => setPromoterChangeDate(e.target.value)}
                />
              </Field>
              <Field
                label="If SEBI has initiated action against a director, when? (blank if never)"
                why="Both exchanges ask that no action initiated by the Board in the past five years is outstanding against a director."
              >
                <input
                  type="date"
                  className={inputClass}
                  value={sebiActionDate}
                  onChange={(e) => setSebiActionDate(e.target.value)}
                />
              </Field>

              {isBSE && (
                <>
                  <YesNo
                    label="Have the promoters holding significant control changed in the last year?"
                    why="BSE SME requires no such change in the preceding year. There is no fix but time."
                    value={controlChanged}
                    onChange={setControlChanged}
                  />
                  <YesNo
                    label="Is any payment to debenture, bond or fixed deposit holders in default?"
                    value={debtDefaults}
                    onChange={setDebtDefaults}
                  />
                  <Field
                    label="If the exchange has rejected a listing application from this company, when? (blank if never)"
                    why="BSE SME requires six complete months to have passed. NSE Emerge asks a different six-month question — about the merchant banker's returned drafts, not yours — which is why it is not asked here."
                  >
                    <input
                      type="date"
                      className={inputClass}
                      value={applicationRejectedDate}
                      onChange={(e) => setApplicationRejectedDate(e.target.value)}
                    />
                  </Field>
                </>
              )}

              {/*
                Both of these were asked only of NSE issuers until corroboration
                against a second BSE document showed BSE states them too.
              */}
              <YesNo
                label="Have insolvency proceedings been admitted against any company promoting yours?"
                why="Both exchanges extend the IBC test beyond the issuer to the promoting companies."
                value={promotingCompanyIbc}
                onChange={setPromotingCompanyIbc}
              />
              <YesNo
                label="Has any exchange suspended trading against a promoter or a company they promote?"
                value={tradingSuspended}
                onChange={setTradingSuspended}
              />
            </>
          )}
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between">
        <Button
          type="button"
          variant="outline"
          disabled={step === 0}
          onClick={() => setStep((s) => s - 1)}
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <Button
          type="button"
          onClick={() => (step === STEPS.length - 1 ? setSubmitted(true) : setStep((s) => s + 1))}
        >
          {step === STEPS.length - 1 ? 'Check my eligibility' : 'Next'}
          {step < STEPS.length - 1 && <ArrowRight className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
