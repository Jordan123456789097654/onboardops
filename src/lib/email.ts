import { prisma } from "./prisma";
import { EMAIL_IMAGES } from "./email-assets";
import { buildEmail } from "./email-template";
import { emailOptedOut } from "./notify-prefs";

const appUrl = () => (process.env.APP_URL || "https://onboardops.org").trim().replace(/^["']+|["']+$/g, "").replace(/\/$/, "");

const FORCED_FROM_EMAIL = "notifications@onboardops.org";

export type SendOpts = { kind?: string; workspaceId?: string | null; workspaceName?: string | null; html?: string };

async function resolveFromHeader(opts: SendOpts): Promise<string> {
  let wsName = opts.workspaceName?.trim();
  if (!wsName && opts.workspaceId) {
    const ws = await prisma.workspace.findUnique({ where: { id: opts.workspaceId }, select: { name: true } }).catch(() => null);
    wsName = ws?.name?.trim();
  }
  const cleanName = wsName ? `${wsName.replace(/[<>"]/g, "").trim()} via OnboardOps` : "OnboardOps";
  return `${cleanName} <${FORCED_FROM_EMAIL}>`;
}

/**
 * Best-effort send. Never throws. Every attempt is recorded in EmailLog.
 * Always forces notifications@onboardops.org as the sender address.
 */
export async function sendEmail(to: string, subject: string, text: string, opts: SendOpts = {}): Promise<{ ok: boolean; error?: string }> {
  const redirect = process.env.EMAIL_REDIRECT_TO?.trim().replace(/^["']+|["']+$/g, "").trim();
  const realTo = redirect || to;
  const finalSubject = redirect ? `[to: ${to}] ${subject}` : subject;
  const finalText = redirect ? `(Test mode: this message was meant for ${to}.)\n\n${text}` : text;
  const finalHtml = opts.html && redirect ? opts.html.replace(/(<body[^>]*>)/i, `$1<div style="background:#fef3c7;color:#78350f;font:12px Arial,sans-serif;padding:8px 12px;text-align:center">Test mode: this message was meant for ${to.replace(/</g, "&lt;")}</div>`) : opts.html;
  const log = (status: "SENT" | "FAILED" | "SKIPPED", error?: string, providerId?: string) =>
    prisma.emailLog.create({ data: { to: realTo, redirectedFrom: redirect ? to : null, subject: finalSubject, kind: opts.kind ?? "", status, error: error?.slice(0, 500), providerId, workspaceId: opts.workspaceId ?? null } }).catch(() => {});

  if (opts.kind) {
    const u = await prisma.user.findFirst({ where: { OR: [{ email: to.toLowerCase() }, { extraEmails: { some: { email: to.toLowerCase() } } }] }, select: { emailPrefs: true } }).catch(() => null);
    if (u && emailOptedOut(u.emailPrefs, opts.kind)) { await log("SKIPPED", "Recipient turned this email type off"); return { ok: false, error: "Recipient opted out" }; }
  }
  const key = process.env.RESEND_API_KEY?.trim().replace(/^["']+|["']+$/g, "").trim();
  if (!key) { await log("SKIPPED", "RESEND_API_KEY not set"); return { ok: false, error: "RESEND_API_KEY not set" }; }
  try {
    const fromHeader = await resolveFromHeader(opts);
    const cids = finalHtml ? Array.from(new Set(Array.from(finalHtml.matchAll(/cid:([a-z-]+)/g)).map((m) => m[1]))).filter((id) => EMAIL_IMAGES[id]) : [];
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: fromHeader,
        to: [realTo],
        subject: finalSubject,
        text: finalText,
        ...(finalHtml ? { html: finalHtml } : {}),
        ...(cids.length ? { attachments: cids.map((id) => ({ filename: `${id}.png`, content: EMAIL_IMAGES[id], content_type: "image/png", content_id: id })) } : {}),
      }),
      signal: AbortSignal.timeout(20000),
    });
    const json = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!res.ok) { const msg = json.message ?? `Resend responded ${res.status}`; await log("FAILED", msg); return { ok: false, error: msg }; }
    await log("SENT", undefined, json.id);
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Email failed";
    await log("FAILED", msg);
    return { ok: false, error: msg };
  }
}

const mail = (subject: string, spec: Parameters<typeof buildEmail>[0]) => ({ subject, ...buildEmail(spec) });
const portal = () => `${appUrl()}/app/my-portal`;
const sev = (s: string) => s.replace(/_/g, " ").toLowerCase();

export const emails = {
  verifyAdditional: (name: string, address: string, url: string) =>
    mail("Confirm this email address for OnboardOps", { icon: "verify", preheader: `Confirm ${address} on your OnboardOps account.`, title: "Confirm this email address", paragraphs: [`Hi ${name}, someone added ${address} to an OnboardOps account. Confirm it to use this address to sign in and find your workplaces.`, "This link works for 24 hours."], button: { label: "Confirm email", url }, note: "If you didn't add this address, ignore this email and it will not be used." }),

  magicLink: (name: string, url: string, workspace?: string) =>
    mail("Your OnboardOps sign-in link", { icon: "magic", preheader: "Tap the button to sign in. The link works once and expires in 15 minutes.", title: workspace ? `Sign in to ${workspace}` : "Sign in to OnboardOps", paragraphs: [`Hi ${name}, tap the button below to finish signing in. No password needed.`, "This link works once and expires in 15 minutes."], button: { label: "Continue to sign in", url }, note: "If you didn't ask for this, you can safely ignore this email. Nobody can sign in without the link." }),

  verify: (name: string, url: string) =>
    mail("Verify your email for OnboardOps", { icon: "verify", preheader: "Confirm your email so you can find and join your workplaces.", title: "Verify your email", paragraphs: [`Hi ${name}, confirm this is your email address so you can see and join the workplaces you are employed at.`, "This link works for 24 hours."], button: { label: "Verify email", url }, note: "If you didn't create an account, you can safely ignore this email." }),

  reset: (name: string, url: string) =>
    mail("Reset your OnboardOps password", { icon: "key", preheader: "Choose a new password. The link expires in 1 hour.", title: "Reset your password", paragraphs: [`Hi ${name}, someone asked to reset the password for your OnboardOps account. Choose a new one with the button below.`, "This link works once and expires in 1 hour."], button: { label: "Choose a new password", url }, note: "If it wasn't you, ignore this email. Your password stays the same." }),

  invite: (name: string, workspace: string, url: string) =>
    mail(`You're invited to ${workspace} on OnboardOps`, { icon: "invite", preheader: `Set your password to join ${workspace}.`, title: `You're invited to ${workspace}`, paragraphs: [`Hi ${name}, you've been given access to ${workspace} on OnboardOps. Choose a password to get started.`, "The link works once and expires in 7 days."], button: { label: "Set your password", url }, note: `After that, sign in any time at ${appUrl()}/login.` }),

  welcome: (name: string, workspace: string, courses: string[]) =>
    mail(`Welcome to ${workspace}`, { icon: "welcome", preheader: `You've been added to ${workspace}.`, title: `Welcome to ${workspace}`, paragraphs: [`Hi ${name}, you've been added to ${workspace}.`, courses.length ? "Here is the training you need to complete:" : "No training is assigned to you yet."], list: courses, button: { label: "Sign in", url: `${appUrl()}/login` } }),

  courseAssigned: (name: string, course: string, reason: string) =>
    mail(`Training assigned: ${course}`, { icon: "book", preheader: `${course} was assigned to you.`, title: "New training assigned", paragraphs: [`Hi ${name}, a course was assigned to you.`], details: [["Course", course], ["Why", reason]], button: { label: "Open my portal", url: portal() } }),

  infraction: (name: string, caseNumber: string, severity: string, summary: string) =>
    mail(`Action required: ${caseNumber} needs your acknowledgment`, { icon: "alert", preheader: `${caseNumber} needs your signature.`, title: "A notice needs your signature", paragraphs: [`Hi ${name}, a ${sev(severity)} was recorded for you.`, "Please read it and sign to confirm you received it. Signing confirms receipt, not agreement."], details: [["Case", caseNumber], ["Type", sev(severity)], ["Summary", summary]], button: { label: "Review and sign", url: portal() } }),

  acknowledged: (issuer: string, employee: string, caseNumber: string) =>
    mail(`${employee} acknowledged ${caseNumber}`, { icon: "seal", preheader: `${employee} signed ${caseNumber}.`, title: `${employee} signed ${caseNumber}`, paragraphs: [`Hi ${issuer}, ${employee} signed the acknowledgment for ${caseNumber}.`], button: { label: "Open infractions", url: `${appUrl()}/app/infractions` } }),

  reminder: (name: string, course: string, when: string) =>
    mail(`Training reminder: ${course}`, { icon: "clock", preheader: `${course} ${when}.`, title: "Training reminder", paragraphs: [`Hi ${name}, "${course}" ${when}.`], button: { label: "Open my portal", url: portal() } }),

  policy: (name: string, policy: string) =>
    mail(`Please review and sign: ${policy}`, { icon: "pen", preheader: `${policy} needs your acknowledgment.`, title: "Please review and sign", paragraphs: [`Hi ${name}, a policy needs your acknowledgment: "${policy}".`], button: { label: "Read and sign", url: portal() } }),

  requestDecision: (name: string, kind: string, status: string, note: string) =>
    mail(`Your ${kind} request was ${status.toLowerCase()}`, { icon: "calendar", preheader: `Your ${kind} request was ${status.toLowerCase()}.`, title: `Your request was ${status.toLowerCase()}`, paragraphs: [`Hi ${name}, your ${kind} request was ${status.toLowerCase()}.`], details: note ? [["Note from your manager", note]] : undefined, button: { label: "Open my portal", url: portal() } }),

  report: (name: string, workspace: string, lines: string[]) =>
    mail(`${workspace}: workforce summary`, { icon: "calendar", preheader: "Your workforce summary.", title: "Workforce summary", paragraphs: [`Hi ${name}, here is where ${workspace} stands right now.`], details: lines.map((l) => { const i = l.indexOf(": "); return [l.slice(0, i), l.slice(i + 2)] as [string, string]; }), button: { label: "Open Command Center", url: `${appUrl()}/app/overview` } }),

  supportReply: (name: string, ref: string, body: string) =>
    mail(`Re: your OnboardOps support request (${ref})`, { icon: "chat", preheader: "We replied to your support request.", title: "We replied to your request", paragraphs: [`Hi ${name},`, ...body.split(/\n{2,}/)], details: [["Reference", ref]], button: { label: "Contact support", url: `${appUrl()}/contact` }, note: "You can reply to this email or use the contact form.", align: "left" }),

  supportAccess: (owner: string, workspace: string, staff: string, reason: string, until: string) =>
    mail(`OnboardOps support accessed ${workspace}`, { icon: "eye", preheader: `${staff} opened read-only support access.`, title: "Support opened read-only access", paragraphs: [`Hi ${owner}, ${staff} from OnboardOps support opened read-only access to ${workspace}. They can look but not change anything.`], details: [["Who", staff], ["Reason", reason], ["Expires", until]], button: { label: "View your audit log", url: `${appUrl()}/app/audit` }, note: "This is recorded in your audit log. If you did not expect it, contact us right away." }),

  workspaceLocked: (owner: string, workspace: string, reason: string) =>
    mail(`${workspace} has been locked`, { icon: "lock", preheader: `${workspace} is locked.`, title: `${workspace} is locked`, paragraphs: [`Hi ${owner}, OnboardOps locked your workspace. Nobody can use it until the issue is resolved.`, "You can still sign in to read the reason and download your data."], details: [["Reason", reason]], button: { label: "Contact support", url: `${appUrl()}/contact` } }),

  workspaceUnlocked: (owner: string, workspace: string) =>
    mail(`${workspace} is unlocked`, { icon: "unlock", preheader: `${workspace} is available again.`, title: "Your workspace is unlocked", paragraphs: [`Hi ${owner}, ${workspace} is available again. Everyone can sign in as usual.`], button: { label: "Sign in", url: `${appUrl()}/login` } }),

  privacyDone: (name: string, ref: string, what: string) =>
    mail(`Your privacy request (${ref}) is complete`, { icon: "shield", preheader: "Your privacy request is complete.", title: "Your privacy request is complete", paragraphs: [`Hi ${name},`, what], details: [["Reference", ref]] }),

  staffAdded: (name: string, role: string) =>
    mail("You were added to the OnboardOps team console", { icon: "team", preheader: `You now have the ${role} role.`, title: "You're on the OnboardOps team", paragraphs: [`Hi ${name}, you now have the ${role} role in the OnboardOps staff console. Sign in with your OnboardOps account.`], button: { label: "Open the staff console", url: `${appUrl()}/admin` } }),
};
