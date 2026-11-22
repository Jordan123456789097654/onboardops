"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { requireWorkspaceRole, MANAGEMENT_ROLES, ADMIN_ROLES, requirePerm } from "@/lib/rbac";
import { storeUpload } from "@/lib/files";
import { notifyEmployee } from "@/lib/notify";
import { DOC_CATEGORIES } from "@/lib/constants";
import { DOC_LINK_ERROR, validDocLink } from "@/lib/doc-links";
import { run } from "./_util";


const schema = z.object({
  employeeId: z.string().min(1),
  title: z.string().trim().min(2, "Give the document a title").max(150),
  category: z.enum(DOC_CATEGORIES),
  restricted: z.boolean(),
  visibleToEmployee: z.boolean(),
  expiresAt: z.string().optional().or(z.literal("")),
});

/** FormData: json + file. Restricted documents (IDs, work authorization) are readable only by Owners and Admins. */
export async function uploadDocumentAction(form: FormData) {
  return run(async () => {
    const ctx = await requirePerm("documents.manage", "documents");
    const d = schema.parse(JSON.parse(String(form.get("json") ?? "{}")));
    const file = form.get("file");
    if (!(file instanceof File)) throw new Error("Choose a file to upload.");
    if (d.restricted && !ADMIN_ROLES.includes(ctx.role)) throw new Error("Only owners and admins can upload restricted documents.");
    const emp = await prisma.employeeProfile.findFirst({ where: { id: d.employeeId, workspaceId: ctx.workspaceId } });
    if (!emp) throw new Error("Employee not found.");
    const stored = await storeUpload(ctx.workspaceId, file, ctx.user.name);
    await prisma.$transaction(async (tx) => {
      const restricted = d.restricted || d.category === "Work authorization (I-9)";
      await tx.employeeDocument.create({ data: { workspaceId: ctx.workspaceId, employeeId: emp.id, fileId: stored.id, title: d.title, category: d.category, restricted, visibleToEmployee: restricted ? false : d.visibleToEmployee, expiresAt: d.expiresAt ? new Date(d.expiresAt) : null, uploadedByName: ctx.user.name } });
      await writeAudit(tx, { workspaceId: ctx.workspaceId, actorMemberId: ctx.id, actorName: ctx.user.name, actionType: "DOCUMENT_UPLOADED", targetType: "Employee", targetId: emp.id, summary: `${emp.staffCode} document "${d.title}" (${d.category}) uploaded${restricted ? ", restricted" : ""}` });
      if (!restricted && d.visibleToEmployee) await notifyEmployee(tx, ctx.workspaceId, emp.id, { title: `A document was added: ${d.title}`, href: "/app/my-portal" });
    });
    revalidatePath("/app", "layout");
    return undefined;
  });
}

/** Documents can be removed (they are not part of the append-only disciplinary record). The removal is audited. */
export async function deleteDocumentAction(id: string) {
  return run(async () => {
    const ctx = await requirePerm("documents.manage", "documents");
    await prisma.$transaction(async (tx) => {
      const doc = await tx.employeeDocument.findFirst({ where: { id, workspaceId: ctx.workspaceId }, include: { employee: true } });
      if (!doc) throw new Error("Document not found.");
      if (doc.restricted && !ADMIN_ROLES.includes(ctx.role)) throw new Error("Only owners and admins can remove restricted documents.");
      await tx.employeeDocument.delete({ where: { id } });
      if (doc.fileId) await tx.storedFile.deleteMany({ where: { id: doc.fileId, workspaceId: ctx.workspaceId } });
      await writeAudit(tx, { workspaceId: ctx.workspaceId, actorMemberId: ctx.id, actorName: ctx.user.name, actionType: "DOCUMENT_DELETED", targetType: "Employee", targetId: doc.employeeId, summary: `${doc.employee.staffCode} document "${doc.title}" removed` });
    });
    revalidatePath("/app", "layout");
    return undefined;
  });
}

/** Attach a document by link (Google Drive, SharePoint, Dropbox, Box). The file stays where it is. */
export async function addDocumentLinkAction(input: unknown) {
  return run(async () => {
    const ctx = await requirePerm("documents.manage", "documents");
    const d = schema.omit({ expiresAt: true }).extend({ url: z.string().trim().max(1000), expiresAt: z.string().optional().or(z.literal("")) }).parse(input);
    if (!validDocLink(d.url)) throw new Error(DOC_LINK_ERROR);
    if (d.restricted && !ADMIN_ROLES.includes(ctx.role)) throw new Error("Only owners and admins can add restricted documents.");
    const emp = await prisma.employeeProfile.findFirst({ where: { id: d.employeeId, workspaceId: ctx.workspaceId } });
    if (!emp) throw new Error("Employee not found.");
    await prisma.$transaction(async (tx) => {
      const restricted = d.restricted || d.category === "Work authorization (I-9)";
      await tx.employeeDocument.create({ data: { workspaceId: ctx.workspaceId, employeeId: emp.id, externalUrl: d.url, title: d.title, category: d.category, restricted, visibleToEmployee: restricted ? false : d.visibleToEmployee, expiresAt: d.expiresAt ? new Date(d.expiresAt) : null, uploadedByName: ctx.user.name } });
      await writeAudit(tx, { workspaceId: ctx.workspaceId, actorMemberId: ctx.id, actorName: ctx.user.name, actionType: "DOCUMENT_LINKED", targetType: "Employee", targetId: emp.id, summary: `${emp.staffCode} document "${d.title}" linked from ${new URL(d.url).hostname}` });
    });
    revalidatePath("/app", "layout");
    return undefined;
  });
}
