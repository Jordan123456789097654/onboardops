"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, setActiveWorkspace } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { verifiedEmails } from "@/lib/user-emails";
import { notifyRoles } from "@/lib/notify";
import { z } from "zod";
import { slugify } from "@/lib/utils";
import { enforceRate } from "@/lib/rate-limit";
import { getMaintenanceState } from "@/lib/maintenance";
import { autoClaimSubdomain } from "@/lib/subdomain";
import { parseLogoDataUrl } from "@/lib/logo";
import { run } from "./_util";

const MAX_OWNED = 10;

/** A signed-in person starts another workspace of their own. They become its Owner, and it opens right away. */
export async function createWorkspaceAction(input: unknown) {
  return run(async () => {
    const user = await getCurrentUser();
    if (!user) throw new Error("Sign in first.");
    await enforceRate("create-workspace", 5, 3600);
    const maint = await getMaintenanceState();
    if (maint.enabled) throw new Error(maint.message || "OnboardOps is currently undergoing scheduled maintenance.");
    const d = z.object({ workspaceName: z.string().trim().min(2, "Enter a company name").max(80), logoDataUrl: z.string().optional() }).parse(input);
    const owned = await prisma.workspaceMember.count({ where: { userId: user.id, role: "OWNER" } });
    if (owned >= MAX_OWNED) throw new Error(`You can own up to ${MAX_OWNED} workspaces. Contact us if you need more.`);
    const logo = d.logoDataUrl ? parseLogoDataUrl(d.logoDataUrl) : null;
    let slug = slugify(d.workspaceName);
    if (await prisma.workspace.findUnique({ where: { slug } })) slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;
    const wsId = await prisma.$transaction(async (tx) => {
      const ws = await tx.workspace.create({ data: { name: d.workspaceName, slug, ...(logo ? { logoData: logo.data, logoMime: logo.mime, logoUpdatedAt: new Date() } : {}) } });
      const member = await tx.workspaceMember.create({ data: { workspaceId: ws.id, userId: user.id, role: "OWNER" } });
      await writeAudit(tx, { workspaceId: ws.id, actorMemberId: member.id, actorName: user.name, actionType: "WORKSPACE_CREATED", targetType: "Workspace", targetId: ws.id, summary: `Workspace "${ws.name}" created by an existing account` });
      return ws.id;
    });
    setActiveWorkspace(wsId);
    await autoClaimSubdomain(wsId, slug).catch(() => {});
    revalidatePath("/workplaces");
    return { to: "/app/overview" };
  });
}

/**
 * Lets a signed-in person with a verified email attach themselves to the employee record an employer created for that same email.
 * Unverified emails cannot claim anything, so nobody can take over someone else's record by typing their address.
 */
export async function claimWorkplaceAction(employeeId: string) {
  return run(async () => {
    const user = await getCurrentUser();
    if (!user) throw new Error("Sign in first.");
    const mine = await verifiedEmails(user);
    if (!mine.length) throw new Error("Verify your email first. We sent you a link.");
    const wsId = await prisma.$transaction(async (tx) => {
      const emp = await tx.employeeProfile.findFirst({ where: { id: employeeId, email: { in: mine }, memberId: null, status: { not: "TERMINATED" } }, include: { workspace: true } });
      if (!emp) throw new Error("That workplace record is not available to join.");
      if (emp.workspace.suspendedAt) throw new Error("That workplace is locked right now.");
      const member = await tx.workspaceMember.upsert({ where: { workspaceId_userId: { workspaceId: emp.workspaceId, userId: user.id } }, create: { workspaceId: emp.workspaceId, userId: user.id, role: "EMPLOYEE" }, update: {} });
      await tx.employeeProfile.update({ where: { id: emp.id }, data: { memberId: member.id } });
      await writeAudit(tx, { workspaceId: emp.workspaceId, actorMemberId: member.id, actorName: user.name, actionType: "EMPLOYEE_JOINED", targetType: "Employee", targetId: emp.id, summary: `${emp.staffCode} ${emp.fullName} created an account and joined (verified email ${user.email})` });
      await notifyRoles(tx, emp.workspaceId, ["OWNER", "ADMIN", "MANAGER"], { title: `${emp.fullName} joined the portal`, body: "Created their own account", href: `/app/employee/${emp.id}` });
      return emp.workspaceId;
    });
    setActiveWorkspace(wsId);
    revalidatePath("/workplaces");
    return { workspaceId: wsId };
  });
}
