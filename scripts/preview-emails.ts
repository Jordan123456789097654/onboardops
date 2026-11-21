// Writes browsable previews of every email to public/email/preview-<name>.html (open http://localhost:3000/email/preview-reset.html).
// Usage: npx tsx --env-file=.env scripts/preview-emails.ts
import fs from "node:fs";
import { emails } from "../src/lib/email";

const url = "https://onboardops.org/reset-password?token=EXAMPLE";
const samples: Record<string, { html: string }> = {
  magic: emails.magicLink("Jordan Ellis", url),
  verify: emails.verify("Jordan Ellis", url),
  reset: emails.reset("Jordan Ellis", url),
  invite: emails.invite("Jordan Ellis", "Northside Supply & Logistics", url),
  welcome: emails.welcome("Jordan Ellis", "Northside Supply & Logistics", ["Warehouse Safety Fundamentals", "Dock & Forklift Operations"]),
  "course-assigned": emails.courseAssigned("Jordan Ellis", "Warehouse Safety Fundamentals", "Required for job role"),
  infraction: emails.infraction("Jordan Ellis", "INF-2026-003", "WRITTEN_INFRACTION", "Crossed the aisle 7 intersection without stopping at the blind corner."),
  acknowledged: emails.acknowledged("Marcus Reyes", "Jordan Ellis", "INF-2026-003"),
  reminder: emails.reminder("Jordan Ellis", "Dock & Forklift Operations", "is due within 3 days"),
  policy: emails.policy("Jordan Ellis", "Code of Conduct & Attendance"),
  "request-decision": emails.requestDecision("Jordan Ellis", "leave of absence", "APPROVED", "Enjoy the time off."),
  "support-reply": emails.supportReply("Jordan Ellis", "A1B2C3D4", "Thanks for writing.\n\nHere is how to fix that: open Settings, then Sign-in & domain."),
  "support-access": emails.supportAccess("Dana Whitfield", "Northside Supply & Logistics", "Sam", "Investigating a quiz grading question", "2026-11-25 15:00 UTC"),
  locked: emails.workspaceLocked("Dana Whitfield", "Northside Supply & Logistics", "Sample reason shown to the owner."),
  unlocked: emails.workspaceUnlocked("Dana Whitfield", "Northside Supply & Logistics"),
  "privacy-done": emails.privacyDone("Jordan Ellis", "A1B2C3D4", "Your request has been completed."),
  "staff-added": emails.staffAdded("Sam", "SUPPORT"),
};
for (const [name, m] of Object.entries(samples)) fs.writeFileSync(`public/email/preview-${name}.html`, m.html.replace(/cid:([a-z-]+)/g, "/email/$1.png"));
console.log(`Wrote ${Object.keys(samples).length} previews to public/email/`);
