import Link from "next/link";
import { PageShell } from "@/components/page-shell";
import { prisma } from "@/lib/prisma";
import { clientIp, hit } from "@/lib/rate-limit";
import { headers } from "next/headers";
import { fmtDate } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Verify a certificate", description: "Check that an OnboardOps training certificate is real.", alternates: { canonical: "/verify" }, robots: { index: false, follow: true } };

export default async function Verify({ searchParams }: { searchParams: { code?: string } }) {
  const code = (searchParams.code ?? "").trim().toUpperCase().slice(0, 20);
  let result: null | { found: false; limited?: boolean } | { found: true; name: string | null; course: string; employer: string; issued: Date | null; expires: Date | null } = null;
  if (code) {
    if (!/^CERT-\d{4,8}$/.test(code)) result = { found: false };
    else if (await hit(`verify:${clientIp(headers())}`, 15, 3600)) result = { found: false, limited: true };
    else {
      const e = await prisma.courseEnrollment.findFirst({ where: { certificateCode: code, status: "PASSED" }, include: { course: true, employee: true, workspace: true } });
      if (!e) result = { found: false };
      else {
        const feats = (e.workspace.features ?? {}) as Record<string, unknown>;
        const show = feats.__publicCerts !== false;
        result = { found: true, name: show ? e.employee.fullName : null, course: e.course.title, employer: e.workspace.name, issued: e.completedAt, expires: e.expiresAt };
      }
    }
  }
  return (
    <PageShell narrow eyebrow="Verify" title="Verify a training certificate" intro="Enter the code printed on an OnboardOps certificate, such as CERT-41207, to confirm that it is real.">
      <form className="flex flex-wrap items-center gap-2" method="get">
        <label className="sr-only" htmlFor="code">Certificate code</label>
        <input id="code" name="code" className="input mono !w-64" placeholder="CERT-41207" defaultValue={code} autoComplete="off" required />
        <button className="btn-primary">Check</button>
      </form>
      {result && (
        <div className="mt-6" aria-live="polite">
          {result.found ? (
            <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-5 text-[14px] text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
              <div className="text-sm font-semibold">This certificate is real.</div>
              <dl className="mt-3 grid gap-x-6 gap-y-2 text-[13px] sm:grid-cols-[120px_1fr]">
                {result.name && <><dt className="opacity-70">Awarded to</dt><dd className="font-medium">{result.name}</dd></>}
                <dt className="opacity-70">Course</dt><dd className="font-medium">{result.course}</dd>
                <dt className="opacity-70">Employer</dt><dd>{result.employer}</dd>
                {result.issued && <><dt className="opacity-70">Issued</dt><dd>{fmtDate(result.issued)}</dd></>}
                {result.expires && <><dt className="opacity-70">{result.expires < new Date() ? "Expired" : "Valid until"}</dt><dd>{fmtDate(result.expires)}</dd></>}
              </dl>
              {result.expires && result.expires < new Date() && <p className="mt-3 text-[13px]">This certificate has expired. The holder may have renewed it under a newer code.</p>}
            </div>
          ) : result.limited ? (
            <p className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-[13px] text-amber-950 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">Too many checks from this address. Please try again in an hour.</p>
          ) : (
            <p className="rounded-lg border border-line p-4 text-[13px]">No certificate matches that code. Check for typing mistakes, such as a letter O instead of the number 0.</p>
          )}
        </div>
      )}
      <p className="mt-8 text-xs leading-relaxed text-soft">This page confirms only that a certificate was issued through OnboardOps. It does not tell you whether the person is currently qualified, employed or allowed to do any task, so check that with the employer. See how we handle this information in our <Link className="text-accent" href="/legal/privacy">Privacy Policy</Link>.</p>
    </PageShell>
  );
}
