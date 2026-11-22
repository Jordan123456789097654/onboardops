import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePageRole, ALL_ROLES } from "@/lib/rbac";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "What is recorded about me" };

/** A plain-language view of what the employer keeps about the signed-in employee, and who can see it. */
export default async function Records() {
  const ctx = await requirePageRole(ALL_ROLES);
  const p = ctx.profile;
  if (!p) redirect("/app/my-portal");
  const [courses, signed, checklists, incidents, cases, docs, requests, shifts] = await Promise.all([
    prisma.courseEnrollment.count({ where: { employeeId: p.id } }),
    prisma.policyAcknowledgment.count({ where: { employeeId: p.id } }),
    prisma.shiftChecklistSubmission.count({ where: { completedByEmployeeId: p.id } }),
    prisma.incidentReport.count({ where: { reporterEmployeeId: p.id } }),
    prisma.infractionCase.count({ where: { employeeId: p.id } }),
    prisma.employeeDocument.count({ where: { employeeId: p.id } }),
    prisma.staffRequest.count({ where: { employeeId: p.id } }),
    prisma.shift.count({ where: { employeeId: p.id } }),
  ]);
  const rows: [string, number, string, string][] = [
    ["Your profile", 1, "Name, work email, phone, emergency contact, job role, department and hire date.", "Managers and above. You can see and ask to update it."],
    ["Training", courses, "Courses assigned to you, your quiz results, certificates and due dates.", "You, and the managers who run training."],
    ["Policies you signed", signed, "Which version you signed and when.", "You, and managers who manage policies."],
    ["Checklists you completed", checklists, "Items you checked, notes and photos you added.", "Supervisors and above, and you."],
    ["Shifts", shifts, "Shifts you were scheduled for and any swaps you asked for.", "Managers who schedule, and coworkers on the same shift see your name."],
    ["Requests", requests, "Time off, leave and other requests, and the decisions.", "You and the managers who decide requests."],
    ["Incident reports you filed", incidents, "Reports with your name on them. Anonymous reports are not stored with your name.", "Roles that review incidents."],
    ["Warnings and conduct records", cases, "Cases about you, your signature, your written response and any appeal.", "Managers and above. Confidential manager notes are not shown to you or to supervisors."],
    ["Documents", docs, "Files or links your employer added, such as licenses.", "Restricted documents are limited to owners and admins."],
  ];
  return (
    <>
      <PageHeader title="What is recorded about me" sub={`${p.fullName} at ${ctx.workspace.name}. Your employer decides what to record. This page shows what exists and who can see it.`}><Link className="btn" href="/app/my-portal">Back to my portal</Link></PageHeader>
      <div className="card divide-y divide-line">
        {rows.map(([t, n, what, who]) => (
          <div key={t} className="grid gap-1 px-4 py-3 text-[13px] sm:grid-cols-[200px_70px_1fr]">
            <div className="font-medium">{t}</div><div className="mono text-soft">{n} {n === 1 ? "item" : "items"}</div>
            <div><p>{what}</p><p className="mt-0.5 text-xs text-soft">Who can see it: {who}</p></div>
          </div>
        ))}
      </div>
      <section className="card mt-4 space-y-2 p-4 text-[13px]">
        <h2 className="text-sm font-semibold">If something looks wrong</h2>
        <p className="text-soft">Ask your manager or HR contact to correct it, or add your own written response to a warning from your portal. You can also ask to update your phone number and emergency contact from the portal. Read the <Link className="text-accent" href="/legal/employee-notice">Employee Privacy Notice</Link> for more detail about your information and your choices.</p>
        <p className="text-soft">Counts include everything on file, even items you no longer see in the portal. OnboardOps staff have no standing access to these records.</p>
      </section>
    </>
  );
}
