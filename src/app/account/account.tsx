"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Camera, Mail, ShieldCheck, Star, Trash2 } from "lucide-react";
import { addEmailAction, changePasswordAction, makePrimaryEmailAction, removeAvatarAction, removeEmailAction, resendEmailVerificationAction, signOutOtherDevicesAction, revokeSessionAction, updateProfileAction, uploadAvatarAction } from "@/actions/account";
import { resendVerificationAction } from "@/actions/auth";
import { Badge, Field, useAction, useToast } from "@/components/ui";
import { fmtDate, fmtDateTime } from "@/lib/utils";
import { TwoFactor, type MfaState } from "./two-factor";
import { ConnectedAccounts, type ConnectedProvider } from "./connected-accounts";

type Me = { id: string; name: string; nickname: string; email: string; verified: boolean; avatarUrl: string | null; hasPassword: boolean; createdAt: string };
type Extra = { id: string; email: string; verified: boolean };

function Card({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return <section className="card mt-5 p-5"><h2 className="text-sm font-semibold">{title}</h2>{sub && <p className="mt-0.5 text-[13px] text-soft">{sub}</p>}<div className="mt-4">{children}</div></section>;
}

/** Shrinks and square-crops an image in the browser so uploads stay small. */
async function toAvatar(file: File): Promise<File> {
  const bmp = await createImageBitmap(file);
  const size = Math.min(bmp.width, bmp.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  canvas.getContext("2d")!.drawImage(bmp, (bmp.width - size) / 2, (bmp.height - size) / 2, size, size, 0, 0, 256, 256);
  const blob: Blob = await new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("Could not read that image."))), "image/jpeg", 0.88));
  return new File([blob], "avatar.jpg", { type: "image/jpeg" });
}

export function Account({ me, extras, mfa, need2fa = false, oauth, sessions = [] }: { me: Me; extras: Extra[]; mfa: MfaState; need2fa?: boolean; oauth: { providers: ConnectedProvider[]; canUnlink: boolean; notice?: string; error?: string }; sessions?: { id: string; device: string; ip: string; at: string; current: boolean }[] }) {
  const router = useRouter();
  const toast = useToast();
  const { exec, pending } = useAction();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(me.name);
  const [nick, setNick] = useState(me.nickname);
  const [cur, setCur] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [email, setEmail] = useState("");
  const [devLink, setDevLink] = useState<string | undefined>();
  const refresh = () => router.refresh();
  const initials = (nick || name).split(/\s+/).map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();

  const pick = async (f: File | undefined) => {
    if (!f) return;
    try {
      const small = await toAvatar(f);
      const fd = new FormData();
      fd.set("file", small);
      exec(() => uploadAvatarAction(fd), { success: "Profile picture updated", onOk: refresh });
    } catch (e) { toast("error", e instanceof Error ? e.message : "Could not read that image."); }
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <>
      <Card title="Profile" sub="Your name is used on records and the audit log. Your nickname is what teammates see around the app.">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative">
            {me.avatarUrl ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={me.avatarUrl} alt="Your profile picture" className="h-20 w-20 rounded-full border border-line object-cover" /> : <span className="flex h-20 w-20 items-center justify-center rounded-full border border-line bg-muted text-xl font-semibold text-soft">{initials}</span>}
            <button className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border border-line bg-surface shadow-sm hover:bg-muted" aria-label="Change profile picture" onClick={() => fileRef.current?.click()}><Camera className="h-4 w-4" /></button>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
          </div>
          <div className="text-[13px]"><button className="btn" disabled={pending} onClick={() => fileRef.current?.click()}>Upload a photo</button>{me.avatarUrl && <button className="btn ml-2" disabled={pending} onClick={() => exec(() => removeAvatarAction(), { success: "Picture removed", onOk: refresh })}>Remove</button>}<p className="mt-2 text-xs text-soft">PNG, JPG or WEBP. It is cropped to a square. Visible to people you share a workplace with.</p></div>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field label="Full name"><input className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></Field>
          <Field label="Nickname (optional)"><input className="input" value={nick} onChange={(e) => setNick(e.target.value)} placeholder="What should people call you?" maxLength={40} /></Field>
        </div>
        <button className="btn-primary mt-4" disabled={pending || (name === me.name && nick === me.nickname)} onClick={() => exec(() => updateProfileAction({ name, nickname: nick }), { success: "Profile saved", onOk: refresh })}>Save profile</button>
      </Card>

      <Card title="Email addresses" sub="You can sign in with any verified address, and employers can find your records with any of them. Up to 5.">
        <ul className="divide-y divide-line rounded-lg border border-line">
          <li className="flex flex-wrap items-center gap-2 px-3 py-2.5 text-[13px]"><Mail className="h-4 w-4 text-soft" /><span className="mono">{me.email}</span><Badge value="ACTIVE" label="Primary" />{!me.verified && <><Badge value="PENDING" label="Not verified" /><button className="btn !h-6 !px-2 !text-[11px]" disabled={pending} onClick={() => exec(() => resendVerificationAction(), { success: "Verification email sent", onOk: (r) => setDevLink(r.devLink) })}>Send link</button></>}{me.verified && <Badge value="PASSED" label="Verified" />}</li>
          {extras.map((x) => (
            <li key={x.id} className="flex flex-wrap items-center gap-2 px-3 py-2.5 text-[13px]"><Mail className="h-4 w-4 text-soft" /><span className="mono">{x.email}</span>{x.verified ? <Badge value="PASSED" label="Verified" /> : <Badge value="PENDING" label="Not verified" />}
              <span className="ml-auto flex gap-1.5">
                {!x.verified && <button className="btn !h-7" disabled={pending} onClick={() => exec(() => resendEmailVerificationAction(x.id), { success: "Verification email sent", onOk: (r) => setDevLink(r.devLink) })}>Resend link</button>}
                {x.verified && <button className="btn !h-7" disabled={pending} onClick={() => exec(() => makePrimaryEmailAction(x.id), { success: "Primary email changed", onOk: refresh })}><Star className="h-3.5 w-3.5" />Make primary</button>}
                <button className="btn !h-7 !px-2" aria-label={`Remove ${x.email}`} disabled={pending} onClick={() => { if (confirm(`Remove ${x.email} from your account?`)) exec(() => removeEmailAction(x.id), { success: "Email removed", onOk: refresh }); }}><Trash2 className="h-3.5 w-3.5" /></button></span></li>
          ))}
        </ul>
        {devLink && <p className="mt-2 break-all rounded-md border border-line bg-muted p-2 text-xs">Local development only: <a className="text-accent underline" href={devLink}>{devLink}</a></p>}
        <form className="mt-4 flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); exec(() => addEmailAction({ email }), { success: "We sent a confirmation link to that address", onOk: (r) => { setEmail(""); setDevLink(r.devLink); refresh(); } }); }}>
          <div className="min-w-60 flex-1"><Field label="Add another email"><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" /></Field></div>
          <button className="btn-primary" disabled={pending || !email}>Add email</button>
        </form>
        <p className="mt-2 text-xs text-soft">We email a link to confirm each new address. It is not used for sign-in or workplace matching until you confirm it.</p>
      </Card>

      <Card title={me.hasPassword ? "Password" : "Set a password"} sub={me.hasPassword ? "Changing it signs you out everywhere else." : "You have been signing in with email links. A password is optional, and you can keep using links."}>
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); if (pw !== pw2) return toast("error", "The two new passwords do not match."); exec(() => changePasswordAction({ current: cur, next: pw }), { success: "Password updated. Other devices were signed out.", onOk: () => { setCur(""); setPw(""); setPw2(""); refresh(); } }); }}>
          {me.hasPassword && <div className="sm:col-span-2"><Field label="Current password"><input className="input" type="password" value={cur} onChange={(e) => setCur(e.target.value)} autoComplete="current-password" /></Field></div>}
          <Field label="New password (8+ characters)"><input className="input" type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" minLength={8} required /></Field>
          <Field label="Confirm new password"><input className="input" type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" minLength={8} required /></Field>
          <div className="sm:col-span-2"><button className="btn-primary" disabled={pending}>{me.hasPassword ? "Change password" : "Set password"}</button> <Link className="ml-2 text-[13px] text-accent" href="/forgot-password">Forgot your password?</Link></div>
        </form>
      </Card>

      <ConnectedAccounts providers={oauth.providers} canUnlink={oauth.canUnlink} notice={oauth.notice} error={oauth.error} />

      <TwoFactor mfa={mfa} need2fa={need2fa} />

      <Card title="Sessions" sub="Signed in somewhere you do not recognize? End every other session.">
        <button className="btn" disabled={pending} onClick={() => { if (confirm("Sign out of every other device? You will stay signed in here.")) exec(() => signOutOtherDevicesAction(), { success: "Signed out everywhere else" }); }}><ShieldCheck className="h-3.5 w-3.5" />Sign out of other devices</button>
        {sessions.length > 0 && <ul className="mt-3 divide-y divide-line text-[13px]">{sessions.map((s) => (
          <li key={s.id} className="flex items-center gap-3 py-2"><div className="min-w-0 flex-1"><div className="font-medium">{s.device || "Unknown device"}{s.current && <span className="ml-2 text-xs text-emerald-700 dark:text-emerald-300">this device</span>}</div><div className="mono text-xs text-soft">{s.ip || "IP unknown"} · active {fmtDateTime(s.at)}</div></div>
            {!s.current && <button className="btn" disabled={pending} onClick={() => exec(() => revokeSessionAction(s.id), { success: "Session ended" })}>End</button>}</li>
        ))}</ul>}
        <p className="mt-3 text-xs text-soft">Account created {fmtDate(me.createdAt)}. Sessions last up to 14 days.</p>
      </Card>

      <Card title="Your data" sub="Download or delete the information we hold about your account.">
        <p className="text-[13px] text-soft">Access and deletion requests go through our privacy process. Records your employer keeps about you belong to them, so ask your employer about those.</p>
        <Link className="btn mt-3" href="/contact">Make a privacy request</Link>
      </Card>
    </>
  );
}
