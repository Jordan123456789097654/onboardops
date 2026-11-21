// Sends one sample of every email template through Resend. With EMAIL_REDIRECT_TO set, all of them go to that address.
// Usage: npx tsx --env-file=.env scripts/test-emails.ts
import { emails, sendEmail } from "../src/lib/email";

const to = process.env.EMAIL_REDIRECT_TO || process.argv[2];
if (!to) throw new Error("Set EMAIL_REDIRECT_TO in .env or pass an address as the first argument.");
if (!process.env.RESEND_API_KEY) throw new Error("RESEND_API_KEY is not set.");

const url = "https://onboardops.org/reset-password?token=EXAMPLE";
const samples: [string, { subject: string; text: string; html: string }][] = [
  ["magic-link", emails.magicLink("Jordan Ellis", url, "Northside Supply & Logistics")],
  ["verify", emails.verify("Jordan Ellis", url)],
  ["request-decision", emails.requestDecision("Jordan Ellis", "leave of absence", "APPROVED", "Enjoy the time off. See you in January.")],
  ["welcome", emails.welcome("Jordan Ellis", "Northside Supply & Logistics", ["Warehouse Safety Fundamentals", "Dock & Forklift Operations"])],
  ["course-assigned", emails.courseAssigned("Jordan Ellis", "Warehouse Safety Fundamentals", "Required for job role")],
  ["infraction", emails.infraction("Jordan Ellis", "INF-2026-003", "WRITTEN_INFRACTION", "Sample summary text.")],
  ["acknowledged", emails.acknowledged("Marcus Reyes", "Jordan Ellis", "INF-2026-003")],
  ["reset", emails.reset("Jordan Ellis", url)],
  ["invite", emails.invite("Jordan Ellis", "Northside Supply & Logistics", url)],
  ["reminder", emails.reminder("Jordan Ellis", "Dock & Forklift Operations", "is due within 3 days")],
  ["policy", emails.policy("Jordan Ellis", "Code of Conduct & Attendance")],
  ["support-reply", emails.supportReply("Jordan Ellis", "A1B2C3D4", "Thanks for writing. Here is how to fix that.")],
  ["support-access", emails.supportAccess("Dana Whitfield", "Northside Supply & Logistics", "Sam from Support", "Investigating a quiz grading question (request A1B2C3D4)", "2026-11-24 15:00 UTC")],
  ["workspace-locked", emails.workspaceLocked("Dana Whitfield", "Northside Supply & Logistics", "Sample reason shown to the owner.")],
  ["workspace-unlocked", emails.workspaceUnlocked("Dana Whitfield", "Northside Supply & Logistics")],
  ["privacy-done", emails.privacyDone("Jordan Ellis", "A1B2C3D4", "Your request has been completed.")],
  ["staff-added", emails.staffAdded("Sam", "SUPPORT")],
];

async function main() {
  let failed = 0;
  for (const [kind, m] of samples) {
    const r = await sendEmail(to!, m.subject, m.text, { kind: `test:${kind}`, html: m.html });
    if (!r.ok) failed++;
    console.log(`${r.ok ? "SENT  " : "FAILED"} ${kind}${r.ok ? "" : "  " + r.error}`);
    await new Promise((res) => setTimeout(res, 700)); // stay under Resend's rate limit
  }
  console.log(`
${samples.length - failed}/${samples.length} sent to ${to}`);
  process.exit(failed ? 1 : 0);
}
main();
