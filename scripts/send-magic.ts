// Emails a one-time sign-in link to an existing account (useful for the first site-owner sign-in).
// Usage: npx tsx --env-file=.env scripts/send-magic.ts someone@example.com
import { prisma } from "../src/lib/prisma";
import { createToken } from "../src/lib/tokens";
import { emails, sendEmail } from "../src/lib/email";

async function main() {
  const email = process.argv[2]?.toLowerCase();
  if (!email) throw new Error("Pass the account email.");
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error(`No account for ${email}`);
  const raw = await createToken(user.id, "MAGIC", 15 * 60_000);
  const url = `${process.env.APP_URL || "http://localhost:3000"}/magic?token=${raw}`;
  const m = emails.magicLink(user.name, url);
  const r = await sendEmail(user.email, m.subject, m.text, { html: m.html, kind: "magic-link" });
  console.log(r.ok ? `Sent a sign-in link for ${email} (check the inbox${process.env.EMAIL_REDIRECT_TO ? `, redirected to ${process.env.EMAIL_REDIRECT_TO}` : ""}).` : `Failed: ${r.error}`);
  await prisma.$disconnect();
}
main();
