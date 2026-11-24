import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * For an external monitor (Better Stack) to poll. Returns 200 when healthy and 503 when something needs attention.
 * It reveals no customer data and no counts, only which check failed.
 */
export async function GET() {
  const problems: string[] = [];
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    return Response.json({ ok: false, problems: ["database"] }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  const since = new Date(Date.now() - 60 * 60_000);
  const failedEmails = await prisma.emailLog.count({ where: { status: "FAILED", createdAt: { gte: since } } }).catch(() => 0);
  if (failedEmails >= 5) problems.push("email");
  const lastJob = await prisma.jobRun.findFirst({ orderBy: { createdAt: "desc" }, select: { ok: true, createdAt: true } }).catch(() => null);
  if (lastJob && !lastJob.ok && lastJob.createdAt >= since) problems.push("job");
  const ok = problems.length === 0;
  return Response.json({ ok, problems }, { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
