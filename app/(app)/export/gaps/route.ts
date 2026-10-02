import { assemble } from '@/lib/export/bundle';
import { buildGapReport, gapReportFilename } from '@/lib/export/gap-report';
import { currentOrgId } from '@/lib/auth/org-context';

export const dynamic = 'force-dynamic';

/** GET /export/gaps — the findings, placeholders and provenance as a workbook. Open to both Admin and Member. */
export async function GET() {
  const a = await assemble(await currentOrgId());
  const bytes = await buildGapReport(a);

  return new Response(new Uint8Array(bytes), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${gapReportFilename(a.facts, a.version)}"`,
      'Content-Length': String(bytes.byteLength),
      'Cache-Control': 'no-store',
    },
  });
}
