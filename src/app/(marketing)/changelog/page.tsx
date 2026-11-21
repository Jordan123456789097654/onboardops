export const metadata = { title: "Changelog" };

const entries = [
  { v: "0.8.0", date: "2026-11-27", items: ["Account settings: profile picture, nickname, add and remove email addresses, make one primary, change your password, and sign out other devices. Any confirmed email can be used to sign in.", "Simpler navigation, with secondary pages under Resources, and a lighter home page.", "Legal pages are much longer and more detailed, with new Employee Privacy Notice and Data Retention and Deletion Policy documents."] },
  { v: "0.7.0", date: "2026-11-26", items: ["Magic links: sign in from an emailed link with no password, on the main sign in and on each workplace's staff sign in.", "New Why OnboardOps page with a side-by-side comparison, a time calculator and a fit check.", "Interactive home page: click through the workflow with real screens, explore what each role can see, and run the numbers for your team.", "Staff console access now requires a verified email."] },
  { v: "0.6.0", date: "2026-11-25", items: ["Employees can create their own account, verify their email, and see Workplaces I'm employed in. Employers that added their email appear to join.", "Workspace staff sign-in at /w/your-name, and custom domains connected through Vercel, with a branded sign-in and a workspace-only app on that address.", "Employees can request a leave of absence, retirement or resignation; managers approve or deny, and records update on the right dates.", "Staff Accounts page: send sign-in invites to many employees at once.", "Employees whose records are closed can no longer sign in.", "Account lockout after repeated wrong passwords.", "Emails are now designed HTML emails with icons."] },
  { v: "0.5.0", date: "2026-11-24", items: ["Staff console for the OnboardOps team: support inbox, workspace directory, time-limited read-only support access that customers can see, account recovery, workspace locking, privacy request queue, beta feedback board, email delivery log, metrics and an append-only staff activity log.", "Send feedback from inside the app."] },
  { v: "0.4.0", date: "2026-11-23", items: ["Password reset by email, and email invites so employees choose their own password. Changing a password signs out other devices.", "Bulk employee import from CSV with a preview and a line-by-line list of skipped rows.", "Due dates, training reminders, expiring certificates that re-enroll automatically, and a daily job to run them.", "In-app notification bell.", "Policies and handbooks with PDF upload, per-role assignment, versioning and signature tracking.", "Employee documents with restricted access, incident reports that can become cases, and performance reviews and 1:1 notes for managers.", "Reports page with charts and a printable compliance report.", "Full workspace export and an owner-only option to close and delete a workspace."] },
  { v: "0.3.0", date: "2026-11-22", items: ["New help center with step-by-step guides, search and a support contact form.", "Legal documents rewritten with numbered sections, plain-English summaries, a table of contents, processing details and a subprocessor list.", "Minimum age is now 13 (with parent or guardian permission under 18).", "Home page now uses real screenshots of the app, with a tabbed gallery.", "New logo, and animations throughout that respect the reduced-motion setting."] },
  { v: "0.2.0", date: "2026-11-21", items: ["Rebuilt the interface: accessible dialogs and drawers, icons, a light / system / dark theme switch, and a new Command Center with course completion and an attention list.", "New public pages: Solutions, Security, About, Contact and FAQ.", "Added Terms of Service, Terms of Use, Privacy Policy, Acceptable Use Policy, Cookie Policy, Data Processing Addendum and Beta Program Terms.", "Registration now requires accepting the Terms and Privacy Policy, and the acceptance is recorded in the audit log.", "Everything is free for beta testers."] },
  { v: "0.1.0", date: "2026-11-20", items: ["Staff directory, employee dossier and status changes with required reasons.", "Training academy: multi-lesson builder, server-graded quizzes, certificate codes (CERT-#####), compliance matrix.", "Infraction ledger with append-only case timeline, confidential notes (managers and above only) and employee acknowledgment.", "Auto-retraining on written infractions or 2+ points; auto-suspend at the workspace strike threshold.", "Shift checklists with supervisor verification.", "Audit log where each entry's SHA-256 hash chains over the previous entry.", "Operations and confidential webhooks for Discord and Slack, plus Resend email notifications."] },
  { v: "0.0.9", date: "2026-11-06", items: ["Fixed: changing a job role no longer duplicates enrollments for courses an employee already has.", "Quiz retake cooldown is now enforced on the server instead of the browser.", "Supervisors can no longer open confidential timeline notes through the case drawer."] },
];

export default function Changelog() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-14">
      <h1 className="text-3xl font-semibold">Changelog</h1>
      <div className="mt-8 space-y-8">
        {entries.map((e) => (
          <article key={e.v} className="grid gap-2 sm:grid-cols-[140px_1fr]">
            <div className="mono text-[13px]"><div className="font-semibold">v{e.v}</div><div className="text-soft">{e.date}</div></div>
            <ul className="list-disc space-y-1.5 pl-4 text-[13px]">{e.items.map((i) => <li key={i}>{i}</li>)}</ul>
          </article>
        ))}
      </div>
    </section>
  );
}
