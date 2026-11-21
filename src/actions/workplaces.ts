"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, setActiveWorkspace } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { verifiedEmails } from "@/lib/user-emails";
import { notifyRoles } from "@/lib/notify";
import { run } from "./_util";

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
