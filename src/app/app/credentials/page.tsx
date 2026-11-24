import { prisma } from "@/lib/prisma";
import { requirePagePerm } from "@/lib/rbac";
import { can } from "@/lib/perms";
import { featureOn } from "@/lib/features";
import { aiConfigured } from "@/lib/ai/groq";
import { careOpen } from "@/lib/ai/guard";
import { Credentials, type CredentialsMetrics } from "./credentials";

export const metadata = { title: "Credentials" };
export const maxDuration = 60;

export default async function CredentialsPage() {
  const ctx = await requirePagePerm("credentials.manage", "credentials");
  const [rows, employees] = await Promise.all([
    prisma.credential.findMany({ where: { workspaceId: ctx.workspaceId }, include: { employee: true }, orderBy: { expiresAt: "asc" } }),
    prisma.employeeProfile.findMany({ where: { workspaceId: ctx.workspaceId, status: { not: "TERMINATED" } }, orderBy: { fullName: "asc" } }),
  ]);

  const now = Date.now();
  const dayMs = 86_400_000;
  const d30 = now + 30 * dayMs;
  const d90 = now + 90 * dayMs;

  let expired = 0;
  let expiring30d = 0;
  let expiring90d = 0;
  let noExpiry = 0;
  const byType = new Map<string, { expired: number; expiring30d: number; expiring90d: number }>();

  for (const c of rows) {
    if (!c.expiresAt) {
      noExpiry++;
      continue;
    }
    const t = c.expiresAt.getTime();
    const key = c.name.trim() || "Untitled credential";
    const bump = (field: "expired" | "expiring30d" | "expiring90d") => {
      const cur = byType.get(key) ?? { expired: 0, expiring30d: 0, expiring90d: 0 };
      cur[field]++;
      byType.set(key, cur);
    };
    if (t < now) {
      expired++;
      bump("expired");
    } else if (t <= d30) {
      expiring30d++;
      bump("expiring30d");
    } else if (t <= d90) {
      expiring90d++;
      bump("expiring90d");
    }
  }

  const topExpiringTypes = Array.from(byType.entries())
    .map(([name, counts]) => ({
      name,
      expired: counts.expired,
      expiring30d: counts.expiring30d,
      expiring31To90d: counts.expiring90d,
      totalNeedingAttention: counts.expired + counts.expiring30d + counts.expiring90d,
    }))
    .sort((a, b) => b.expired - a.expired || b.expiring30d - a.expiring30d || b.totalNeedingAttention - a.totalNeedingAttention)
    .slice(0, 6);

  const metrics: CredentialsMetrics = {
    total: rows.length,
    expired,
    expiring30d,
    expiring90d,
    noExpiry,
    currentOver90d: rows.length - expired - expiring30d - expiring90d - noExpiry,
    topExpiringTypes,
  };

  const ai = aiConfigured() && featureOn(ctx.workspace.features, "ai");
  const aiCare = ai && featureOn(ctx.workspace.features, "aiPeople") && careOpen();
  const canMatchDocs = can(ctx, "documents.manage");
  const canUploadDocs = canMatchDocs && featureOn(ctx.workspace.features, "documents");

  return (
    <Credentials
      rows={rows.map((c) => ({
        id: c.id,
        employee: `${c.employee.staffCode} ${c.employee.fullName}`,
        name: c.name,
        number: c.number,
        issuer: c.issuer,
        expiresAt: c.expiresAt ? c.expiresAt.toISOString() : null,
      }))}
      employees={employees.map((e) => ({ id: e.id, label: `${e.staffCode} ${e.fullName}` }))}
      ai={ai}
      aiCare={aiCare}
      canMatchDocs={canMatchDocs}
      canUploadDocs={canUploadDocs}
      metrics={metrics}
    />
  );
}
