"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { requireWorkspaceRole, MANAGEMENT_ROLES } from "@/lib/rbac";
import { assignRoleCourses, dispatchEffects, newEffects } from "@/lib/automations";
import { run } from "./_util";

const rowSchema = z.object({
  fullName: z.string().trim().min(2),
  email: z.string().trim().email(),
  phone: z.string().trim().optional().default(""),
  emergencyContact: z.string().trim().optional().default(""),
  department: z.string().trim().optional().default(""),
  jobRole: z.string().trim().optional().default(""),
  hireDate: z.string().trim().optional().default(""),
});
const inputSchema = z.object({ rows: z.array(z.unknown()).min(1, "The file has no rows").max(500, "Import at most 500 rows at a time"), createMissing: z.boolean(), sendWelcome: z.boolean() });

export type ImportResult = { created: number; skipped: { line: number; email: string; reason: string }[] };

export async function importEmployeesAction(input: unknown) {
  return run(async (): Promise<ImportResult> => {
    const ctx = await requireWorkspaceRole(MANAGEMENT_ROLES);
    const d = inputSchema.parse(input);
    const fx = newEffects();
    const skipped: ImportResult["skipped"] = [];
    let created = 0;
    const codes: string[] = [];

    await prisma.$transaction(async (tx) => {
      const [depts, roles, existing, all] = await Promise.all([
        tx.department.findMany({ where: { workspaceId: ctx.workspaceId } }),
        tx.jobRole.findMany({ where: { workspaceId: ctx.workspaceId } }),
        tx.employeeProfile.findMany({ where: { workspaceId: ctx.workspaceId }, select: { email: true } }),
        tx.employeeProfile.findMany({ where: { workspaceId: ctx.workspaceId }, select: { staffCode: true } }),
      ]);
      const seen = new Set(existing.map((e) => e.email.toLowerCase()));
      let n = all.reduce((m, e) => Math.max(m, parseInt(e.staffCode.replace(/\D/g, ""), 10) || 1000), 1000);
      const deptBy = new Map(depts.map((x) => [x.name.toLowerCase(), x.id]));
      const roleBy = new Map(roles.map((x) => [x.title.toLowerCase(), x.id]));

      for (let i = 0; i < d.rows.length; i++) {
        const line = i + 2; // header is line 1
        const parsed = rowSchema.safeParse(d.rows[i]);
        if (!parsed.success) { skipped.push({ line, email: String((d.rows[i] as { email?: string })?.email ?? ""), reason: "Name and a valid email are required" }); continue; }
        const r = parsed.data;
        const email = r.email.toLowerCase();
        if (seen.has(email)) { skipped.push({ line, email, reason: "Already exists in this workspace or earlier in the file" }); continue; }
        let hire = new Date();
        if (r.hireDate) {
          const t = new Date(r.hireDate);
          if (isNaN(t.getTime())) { skipped.push({ line, email, reason: `Hire date "${r.hireDate}" is not a date (use YYYY-MM-DD)` }); continue; }
          hire = t;
        }
        let departmentId: string | null = null;
        if (r.department) {
          departmentId = deptBy.get(r.department.toLowerCase()) ?? null;
          if (!departmentId) {
            if (!d.createMissing) { skipped.push({ line, email, reason: `Unknown department "${r.department}"` }); continue; }
            const nd = await tx.department.create({ data: { workspaceId: ctx.workspaceId, name: r.department } });
            deptBy.set(r.department.toLowerCase(), nd.id);
            departmentId = nd.id;
          }
        }
        let jobRoleId: string | null = null;
        if (r.jobRole) {
          jobRoleId = roleBy.get(r.jobRole.toLowerCase()) ?? null;
          if (!jobRoleId) {
            if (!d.createMissing) { skipped.push({ line, email, reason: `Unknown job role "${r.jobRole}"` }); continue; }
            const nr = await tx.jobRole.create({ data: { workspaceId: ctx.workspaceId, title: r.jobRole, requiredCourseIds: [] } });
            roleBy.set(r.jobRole.toLowerCase(), nr.id);
            jobRoleId = nr.id;
          }
        }
        n += 1;
        const staffCode = `EMP-${n}`;
        const emp = await tx.employeeProfile.create({ data: { workspaceId: ctx.workspaceId, staffCode, fullName: r.fullName, email, phone: r.phone || null, emergencyContact: r.emergencyContact || null, departmentId, jobRoleId, hireDate: hire } });
        const rowFx = newEffects();
        await assignRoleCourses(tx, { workspaceId: ctx.workspaceId, employeeId: emp.id, jobRoleId, reason: "Required for job role (imported hire)", fx: rowFx, employeeName: emp.fullName, employeeEmail: emp.email, workspaceName: ctx.workspace.name, isHire: true });
        if (d.sendWelcome) fx.mail.push(...rowFx.mail);
        seen.add(email);
        codes.push(staffCode);
        created++;
      }
      await writeAudit(tx, { workspaceId: ctx.workspaceId, actorMemberId: ctx.id, actorName: ctx.user.name, actionType: "EMPLOYEES_IMPORTED", targetType: "Workspace", targetId: ctx.workspaceId, summary: `Imported ${created} employee(s) from CSV, skipped ${skipped.length}`, metadata: { staffCodes: codes, skipped: skipped.length } });
    }, { timeout: 120000, maxWait: 15000 });

    await dispatchEffects(ctx, fx);
    revalidatePath("/app", "layout");
    return { created, skipped };
  });
}
