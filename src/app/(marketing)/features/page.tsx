import { CtaBand, PageShell } from "@/components/page-shell";
import { RoleExplorer } from "@/components/home-interactive";

export const metadata = { title: "Product" };

const sections = [
  { id: "directory", t: "Staff directory and dossier", p: "Search and filter by department, status and readiness, then export to CSV. Each employee has one dossier with contact details, shift availability, training, infractions and an audit trail. Change status with a required reason, and print the whole dossier to PDF.", b: ["Staff IDs like EMP-1001, unique per workspace", "Statuses: onboarding, active, leave of absence, suspended, terminated", "Readiness: pending, certified, retraining required"] },
  { id: "training", t: "Training and certification", p: "Build courses from Markdown lessons with optional video and a minimum read time. Add a quiz with four options per question and an explanation shown after grading. Quizzes are graded on the server, so scores cannot be edited in the browser.", b: ["Passing score and retake cooldown set per course", "Certificate codes like CERT-48213 with a printable page", "Compliance matrix across every employee and course", "Job roles enroll new hires in required courses automatically"] },
  { id: "infractions", t: "Infractions and internal affairs", p: "Five severities from verbal warning to termination. Points accumulate on the employee. The employee signs an acknowledgment, which confirms receipt and not agreement. Timeline notes can only be added, never edited or removed.", b: ["Evidence links and confidential manager notes", "Appeals logged on the case timeline", "Supervisors can issue verbal and written warnings only", "Written infractions assign the remedial course automatically"] },
  { id: "automation", t: "Automatic follow-through", p: "Three rules run inside a database transaction so a record is never half-updated: role changes enroll courses, passing every required course certifies the employee, and an infraction can trigger retraining, suspension or termination.", b: ["Suspend automatically at your strike-point limit", "Notifications go out only after the change is saved", "Every automatic action is written to the audit log"] },
  { id: "checklists", t: "Shift checklists", p: "Create opening, mid-shift and closing templates for each department. Employees submit them from their portal with handoff notes. Supervisors verify completed logs.", b: ["Required and optional items", "Verification by name and time", "Logs visible to managers and above"] },
  { id: "notify", t: "Webhooks and email", p: "Connect two Discord or Slack webhooks: one for operations news and one for confidential HR events. Employees receive email for new training and infractions that need a signature.", b: ["Send a test message from Settings", "Confidential notes are never included in a notification", "Email delivery through Resend"] },
  { id: "audit", t: "Append-only audit log", p: "Every important action is recorded with who did it, what changed and when. Each entry's SHA-256 hash includes the previous entry's hash, so gaps and edits are detectable.", b: ["Searchable by actor, action and target", "No edit or delete actions exist", "Visible to owners and admins"] },
];

export default function Features() {
  return (
    <PageShell eyebrow="Product" title="What's in OnboardOps" intro="Seven pieces that share one employee record. Everything below is available to beta testers at no cost.">
      <div className="divide-y divide-line border-y border-line">
        {sections.map((s) => (
          <section key={s.id} id={s.id} className="grid gap-4 py-8 md:grid-cols-[260px_1fr]">
            <h2 className="text-lg font-semibold">{s.t}</h2>
            <div><p className="text-[14px] leading-relaxed text-soft">{s.p}</p><ul className="mt-3 space-y-1 text-[13px]">{s.b.map((x) => <li key={x} className="flex gap-2"><span className="mono text-soft">+</span>{x}</li>)}</ul></div>
          </section>
        ))}
      </div>
      <section id="roles" className="mt-16 scroll-mt-20">
        <h2 className="text-2xl font-semibold">Everyone sees only what they should</h2>
        <p className="mt-2 max-w-2xl text-[14px] text-soft">Pick a role to see what it gets. Roles are checked on the server for every request. Hiding a button is not the control.</p>
        <div className="mt-6"><RoleExplorer /></div>
      </section>
      <CtaBand />
    </PageShell>
  );
}
