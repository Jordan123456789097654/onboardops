"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { requireWorkspaceRole, MANAGEMENT_ROLES, ALL_ROLES, requirePerm, requireFeature } from "@/lib/rbac";
import { storeUpload } from "@/lib/files";
import { notifyMembers } from "@/lib/notify";
import { emails, sendEmail } from "@/lib/email";
import { DOC_LINK_ERROR, validDocLink } from "@/lib/doc-links";
import { run } from "./_util";

const schema = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(3, "Give the policy a title").max(150),
  description: z.string().trim().max(1000).default(""),
  contentMarkdown: z.string().max(50000).default(""),
  appliesToAll: z.boolean(),
  requiredJobRoleIds: z.array(z.string()),
  publish: z.boolean(),
  newVersion: z.boolean(),
  externalUrl: z.string().trim().max(1000).default(""),
});

/** FormData fields: json (the schema above, as JSON) and an optional file. */
export async function savePolicyAction(form: FormData) {
  return run(async () => {
    const ctx = await requirePerm("policies.manage", "policies");
    const d = schema.parse(JSON.parse(String(form.get("json") ?? "{}")));
    const file = form.get("file");
    const hasFile = file instanceof File && file.size > 0;
    if (d.externalUrl && !validDocLink(d.externalUrl)) throw new Error(DOC_LINK_ERROR);
    if (!d.appliesToAll && d.requiredJobRoleIds.length === 0) throw new Error("Pick at least one job role, or apply the policy to everyone.");

    const stored = hasFile ? await storeUpload(ctx.workspaceId, file as File, ctx.user.name) : null;
    const result = await prisma.$transaction(async (tx) => {
      const roles = await tx.jobRole.findMany({ where: { id: { in: d.requiredJobRoleIds }, workspaceId: ctx.workspaceId }, select: { id: true } });
      const base = { title: d.title, description: d.description, contentMarkdown: d.contentMarkdown, appliesToAll: d.appliesToAll, requiredJobRoleIds: roles.map((r) => r.id), isPublished: d.publish, externalUrl: d.externalUrl || null, ...(stored ? { fileId: stored.id, fileName: stored.name } : {}) };
      let policy;
      if (d.id) {
        const ex = await tx.policy.findFirst({ where: { id: d.id, workspaceId: ctx.workspaceId } });
        if (!ex) throw new Error("Policy not found.");
        policy = await tx.policy.update({ where: { id: d.id }, data: { ...base, version: d.newVersion ? ex.version + 1 : ex.version } });
      } else {
        if (!d.contentMarkdown && !stored && !d.externalUrl) throw new Error("Add the policy text or upload a PDF.");
        policy = await tx.policy.create({ data: { ...base, workspaceId: ctx.workspaceId } });
      }
      if (!policy.fileId && !policy.contentMarkdown && !policy.externalUrl) throw new Error("Add the policy text or upload a PDF.");
      await writeAudit(tx, { workspaceId: ctx.workspaceId, actorMemberId: ctx.id, actorName: ctx.user.name, actionType: d.id ? (d.newVersion ? "POLICY_NEW_VERSION" : "POLICY_UPDATED") : "POLICY_CREATED", targetType: "Policy", targetId: policy.id, summary: `Policy "${policy.title}" v${policy.version} ${d.publish ? "published" : "saved as draft"}` });
      const needsSign = d.publish && (!d.id || d.newVersion);
      let notified = 0;
      if (needsSign) {
        const emps = await tx.employeeProfile.findMany({ where: { workspaceId: ctx.workspaceId, status: { not: "TERMINATED" }, ...(policy.appliesToAll ? {} : { jobRoleId: { in: policy.requiredJobRoleIds } }) }, select: { fullName: true, email: true, memberId: true } });
        await notifyMembers(tx, ctx.workspaceId, emps.map((e) => e.memberId), { title: `Please sign: ${policy.title}`, body: `Version ${policy.version}`, href: "/app/my-portal" });
        notified = emps.length;
        return { policy, emps };
      }
      return { policy, emps: [] as { fullName: string; email: string }[], notified };
    });
    for (const e of result.emps) { const m = emails.policy(e.fullName, result.policy.title); await sendEmail(e.email, m.subject, m.text, { html: m.html }); }
    revalidatePath("/app", "layout");
    return { id: result.policy.id };
  });
}

export async function acknowledgePolicyAction(policyId: string, input: unknown) {
  return run(async () => {
    const ctx = await requireFeature("policies");
    const d = z.object({ signatureName: z.string().trim().min(2, "Type your full name to sign") }).parse(input);
    const me = ctx.profile;
    if (!me) throw new Error("No employee profile is linked to your login.");
    if (d.signatureName.toLowerCase() !== me.fullName.toLowerCase()) throw new Error(`Type your name exactly as it appears on your record: ${me.fullName}`);
    await prisma.$transaction(async (tx) => {
      const p = await tx.policy.findFirst({ where: { id: policyId, workspaceId: ctx.workspaceId, isPublished: true } });
      if (!p) throw new Error("Policy not found.");
      if (!p.appliesToAll && !(me.jobRoleId && p.requiredJobRoleIds.includes(me.jobRoleId))) throw new Error("This policy does not apply to your role.");
      const ex = await tx.policyAcknowledgment.findUnique({ where: { policyId_employeeId_version: { policyId, employeeId: me.id, version: p.version } } });
      if (ex) throw new Error("You already signed this version.");
      await tx.policyAcknowledgment.create({ data: { workspaceId: ctx.workspaceId, policyId, employeeId: me.id, version: p.version, signatureName: d.signatureName } });
      await writeAudit(tx, { workspaceId: ctx.workspaceId, actorMemberId: ctx.id, actorName: ctx.user.name, actionType: "POLICY_ACKNOWLEDGED", targetType: "Policy", targetId: policyId, summary: `${me.staffCode} acknowledged "${p.title}" v${p.version}` });
    });
    revalidatePath("/app", "layout");
    return undefined;
  });
}
