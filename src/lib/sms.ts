import { prisma } from "./prisma";
import { hit } from "./rate-limit";
import { open } from "./secret-box";

/** Each workspace brings its own Twilio account. OnboardOps never sends texts on its own account. */
export type SmsConfig = { sid: string; token: string; from: string };

export const hasSmsConfig = (w: { smsAccountSid: string | null; smsAuthTokenEnc: string | null; smsFrom: string | null }) => !!(w.smsAccountSid && w.smsAuthTokenEnc && w.smsFrom);

/** US-friendly E.164: 10 digits get +1, 11 digits starting with 1 get +, anything starting with + is kept. */
export function toE164(raw: string): string | null {
  const t = raw.trim();
  const d = t.replace(/\D/g, "");
  if (t.startsWith("+") && d.length >= 8 && d.length <= 15) return `+${d}`;
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d.startsWith("1")) return `+${d}`;
  return null;
}

export async function loadSmsConfig(workspaceId: string): Promise<SmsConfig | null> {
  const w = await prisma.workspace.findUnique({ where: { id: workspaceId }, select: { smsAccountSid: true, smsAuthTokenEnc: true, smsFrom: true } });
  if (!w || !hasSmsConfig(w)) return null;
  const token = open(w.smsAuthTokenEnc!);
  return token ? { sid: w.smsAccountSid!, token, from: w.smsFrom! } : null;
}

/** Sends one text through the workspace's own Twilio account. Never throws. */
export async function sendSms(cfg: SmsConfig, to: string, body: string): Promise<{ ok: boolean; error?: string }> {
  const number = toE164(to);
  if (!number) return { ok: false, error: "That phone number is not valid." };
  try {
    const params = new URLSearchParams({ To: number, Body: `${body.slice(0, 300)} Reply STOP to opt out.` });
    params.set(cfg.from.startsWith("MG") ? "MessagingServiceSid" : "From", cfg.from);
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${cfg.sid}/Messages.json`, {
      method: "POST",
      headers: { Authorization: `Basic ${Buffer.from(`${cfg.sid}:${cfg.token}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: params,
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) return { ok: true };
    return { ok: false, error: res.status === 401 ? "Twilio rejected the account SID or auth token." : `Twilio answered ${res.status}` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message.slice(0, 100) : "Text request failed" };
  }
}

/** Texts an employee only if their workspace set up Twilio, they opted in and they have a phone number. Capped at 10 an hour per person. */
export async function textEmployee(workspaceId: string, employeeId: string, body: string) {
  try {
    const e = await prisma.employeeProfile.findFirst({ where: { id: employeeId, workspaceId }, select: { phone: true, smsOptIn: true } });
    if (!e?.smsOptIn || !e.phone) return;
    const cfg = await loadSmsConfig(workspaceId);
    if (!cfg) return;
    if (await hit(`sms:${employeeId}`, 10, 3600)) return;
    await sendSms(cfg, e.phone, body);
  } catch {
    // never block the action that triggered it
  }
}
