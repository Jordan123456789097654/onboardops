"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Upload } from "lucide-react";
import { loginAction, registerAction } from "@/actions/auth";
import { Brand, Field, ThemeToggle, useAction } from "@/components/ui";
import { MagicLinkBox } from "@/components/magic-link-box";
import { GitHubIcon, GoogleIcon } from "@/components/social-icons";

const points = ["One record per employee, from hire to audit trail", "Server-graded quizzes and printable certificates", "Confidential notes that employees never receive", "Free for beta testers"];

const ACCEPTED_LOGO_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const LOGO_MAX_DIM = 512;
const LOGO_TARGET_BYTES = 350 * 1024;
const LOGO_HARD_MAX_BYTES = 512 * 1024;

function dataUrlByteLength(dataUrl: string): number {
  const comma = dataUrl.indexOf(",");
  if (comma === -1) return Infinity;
  const b64 = dataUrl.slice(comma + 1);
  const pad = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  return Math.floor((b64.length * 3) / 4) - pad;
}

function loadLogoImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Could not read that image. Try a PNG, JPG, or WebP file."));
    };
    img.src = objectUrl;
  });
}

async function resizeRegistrationLogo(file: File): Promise<string> {
  if (!ACCEPTED_LOGO_TYPES.has(file.type)) {
    throw new Error("Please choose a PNG, JPG, or WebP image.");
  }
  if (file.size > 20 * 1024 * 1024) {
    throw new Error("Image file is too large to process (max 20 MB source file).");
  }

  const img = await loadLogoImage(file);
  const naturalW = img.naturalWidth || img.width;
  const naturalH = img.naturalHeight || img.height;
  if (!naturalW || !naturalH) {
    throw new Error("Could not read image dimensions.");
  }

  const renderCanvas = (maxDim: number, fillWhite: boolean) => {
    const scale = Math.min(1, maxDim / Math.max(naturalW, naturalH));
    const width = Math.max(1, Math.round(naturalW * scale));
    const height = Math.max(1, Math.round(naturalH * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Browser canvas is unavailable.");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    if (fillWhite) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
    }
    ctx.drawImage(img, 0, 0, width, height);
    return canvas;
  };

  for (const maxDim of [LOGO_MAX_DIM, 384, 256]) {
    const canvas = renderCanvas(maxDim, file.type === "image/jpeg");

    if (file.type === "image/jpeg") {
      for (const quality of [0.9, 0.82, 0.72]) {
        const url = canvas.toDataURL("image/jpeg", quality);
        if (url.startsWith("data:image/jpeg;base64,") && dataUrlByteLength(url) <= LOGO_TARGET_BYTES) {
          return url;
        }
      }
      continue;
    }

    const pngUrl = canvas.toDataURL("image/png");
    if (pngUrl.startsWith("data:image/png;base64,") && dataUrlByteLength(pngUrl) <= LOGO_TARGET_BYTES) {
      return pngUrl;
    }

    for (const quality of [0.9, 0.82, 0.72]) {
      const webpUrl = canvas.toDataURL("image/webp", quality);
      if (webpUrl.startsWith("data:image/webp;base64,") && dataUrlByteLength(webpUrl) <= LOGO_TARGET_BYTES) {
        return webpUrl;
      }
    }

    if (maxDim === 256) {
      const matte = renderCanvas(maxDim, true);
      const jpgUrl = matte.toDataURL("image/jpeg", 0.85);
      if (jpgUrl.startsWith("data:image/jpeg;base64,") && dataUrlByteLength(jpgUrl) <= LOGO_HARD_MAX_BYTES) {
        return jpgUrl;
      }
    }
  }

  throw new Error("Could not compress logo under 350 KB. Try a simpler PNG, JPG, or WebP image.");
}

export function AuthForm({ mode, providers = [], oauthError }: { mode: "login" | "register"; providers?: ("google" | "github")[]; oauthError?: string }) {
  const router = useRouter();
  const { exec, pending } = useAction();
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [f, setF] = useState({ name: "", email: "", password: "", workspaceName: "" });
  const [accept, setAccept] = useState(false);
  const [magic, setMagic] = useState(false);
  const [kind, setKind] = useState<"OWNER" | "EMPLOYEE">("OWNER");
  const [logoDataUrl, setLogoDataUrl] = useState("");
  const [logoFileName, setLogoFileName] = useState("");
  const [logoBusy, setLogoBusy] = useState(false);
  const [logoErr, setLogoErr] = useState("");
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  const pickLogo = async (file: File | undefined) => {
    if (!file) return;
    setLogoErr("");
    setLogoBusy(true);
    try {
      const dataUrl = await resizeRegistrationLogo(file);
      setLogoDataUrl(dataUrl);
      setLogoFileName(file.name);
    } catch (e) {
      setLogoErr(e instanceof Error ? e.message : "Could not process that logo image.");
    } finally {
      setLogoBusy(false);
      if (logoInputRef.current) logoInputRef.current.value = "";
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    exec(
      () =>
        mode === "login"
          ? loginAction({ email: f.email, password: f.password })
          : registerAction({
              ...f,
              accountType: kind,
              logoDataUrl: kind === "OWNER" && logoDataUrl ? logoDataUrl : undefined,
              acceptTerms: accept,
              ref: (() => {
                try {
                  return localStorage.getItem("oo-ref") ?? undefined;
                } catch {
                  return undefined;
                }
              })(),
              address: new URLSearchParams(window.location.search).get("address") ?? undefined,
            }),
      {
        onOk: (d) => {
          if (d.to.startsWith("/api/")) {
            window.location.href = d.to;
            return;
          }
          router.push(d.to);
          router.refresh();
        },
      }
    );
  };

  const submitDisabled =
    pending ||
    logoBusy ||
    (mode === "register" && !accept);

  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1.1fr]">
      <aside className="hidden flex-col justify-between border-r border-line bg-surface p-10 lg:flex">
        <Link href="/" aria-label="OnboardOps home"><Brand intro /></Link>
        <div>
          <h2 className="max-w-sm text-2xl font-semibold">Stop running HR out of spreadsheets and training out of group chats.</h2>
          <ul className="mt-6 space-y-2 text-[13px] text-soft">{points.map((p) => <li key={p} className="flex gap-2"><span className="mono">+</span>{p}</li>)}</ul>
        </div>
        <p className="mono text-xs text-soft">Based in Georgia, USA · Beta</p>
      </aside>
      <div className="flex flex-col p-4">
        <div className="flex justify-between lg:justify-end"><Link href="/" aria-label="OnboardOps home" className="lg:hidden"><Brand /></Link><ThemeToggle /></div>
        <div className="flex flex-1 items-center justify-center">
          {mode === "login" && magic ? <div className="w-full max-w-sm"><h1 className="mb-3 text-xl font-semibold">Sign in with a link</h1><MagicLinkBox initialEmail={f.email} onBack={() => setMagic(false)} /></div> : (
          <form onSubmit={submit} className="w-full max-w-sm space-y-4">
            <div><h1 className="text-xl font-semibold">{mode === "login" ? "Sign in" : kind === "OWNER" ? "Create a workspace" : "Create your account"}</h1><p className="mt-1 text-[13px] text-soft">{mode === "login" ? "Welcome back." : kind === "OWNER" ? "Free during the beta. No card needed." : "For employees. After you verify your email, the workplaces that added you appear for you to join."}</p></div>
            {mode === "register" && (
              <div role="radiogroup" aria-label="Account type" className="grid grid-cols-2 gap-1 rounded-lg border border-line bg-muted p-1 text-[13px]">
                {([["OWNER", "I run a company"], ["EMPLOYEE", "I work for a company"]] as const).map(([k, l]) => <button type="button" key={k} role="radio" aria-checked={kind === k} onClick={() => setKind(k)} className={`rounded-md px-2 py-1.5 font-medium transition-all ${kind === k ? "bg-surface shadow-sm" : "text-soft hover:text-ink"}`}>{l}</button>)}
              </div>
            )}
            {mode === "register" && (<>
              <Field label="Your name"><input className="input" value={f.name} onChange={set("name")} autoComplete="name" required /></Field>
              {kind === "OWNER" && (
                <>
                  <Field label="Company name"><input className="input" value={f.workspaceName} onChange={set("workspaceName")} required /></Field>
                  <div className="block">
                    <span className="label">Company logo <span className="font-normal text-soft">(optional, you can add it later)</span></span>
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      aria-label="Company logo"
                      onChange={(e) => pickLogo(e.target.files?.[0])}
                    />
                    {logoDataUrl ? (
                      <div className="flex items-center gap-3 rounded-md border border-line bg-surface p-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={logoDataUrl}
                          alt="Company logo preview"
                          className="h-11 w-11 shrink-0 rounded-md border border-line bg-surface object-contain p-0.5"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[13px] font-medium text-ink">{logoFileName || "Company logo"}</div>
                          <div className="text-[11px] text-soft">Ready for workspace branding</div>
                        </div>
                        <button
                          type="button"
                          className="btn !h-7 shrink-0 !px-2.5 !text-xs"
                          disabled={logoBusy}
                          onClick={() => logoInputRef.current?.click()}
                        >
                          {logoBusy ? "Processing…" : "Change"}
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={logoBusy}
                        onClick={() => logoInputRef.current?.click()}
                        className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-line bg-muted/40 px-3 py-2.5 text-[13px] font-medium text-ink transition-colors hover:bg-muted disabled:opacity-50"
                      >
                        <Upload className="h-4 w-4 text-soft" />
                        {logoBusy ? "Processing logo…" : "Upload company logo"}
                      </button>
                    )}
                    <span className="mt-1 block text-xs text-soft">Required for workspace branding (PNG, JPG or WebP)</span>
                    {logoErr && <span role="alert" className="mt-1 block text-xs text-rose-600">{logoErr}</span>}
                  </div>
                </>
              )}
            </>)}
            <Field label={mode === "register" && kind === "EMPLOYEE" ? "Email (use the one your employer has for you)" : "Work email"}><input className="input" type="email" value={f.email} onChange={set("email")} autoComplete="email" required /></Field>
            <Field label="Password"><input className="input" type="password" value={f.password} onChange={set("password")} autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={mode === "register" ? 8 : 1} /></Field>
            {mode === "login" && <p className="-mt-2 text-right text-xs"><Link className="text-accent" href="/forgot-password">Forgot password?</Link></p>}
            {mode === "register" && (
              <label className="flex items-start gap-2 text-xs text-soft">
                <input type="checkbox" className="mt-0.5" checked={accept} onChange={(e) => setAccept(e.target.checked)} required />
                <span>I am at least 13 years old (with a parent or guardian&apos;s permission if under 18) and agree to the <Link className="text-accent underline" href="/legal/terms-of-service" target="_blank">Terms of Service</Link>, <Link className="text-accent underline" href="/legal/privacy" target="_blank">Privacy Policy</Link> and <Link className="text-accent underline" href="/legal/beta-terms" target="_blank">Beta Program Terms</Link>.</span>
              </label>
            )}
            {oauthError && <p role="alert" className="rounded-md border border-rose-300 bg-rose-50 p-3 text-[13px] text-rose-900 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200">{oauthError}</p>}
            <button
              className="btn-primary !h-10 w-full !text-sm"
              disabled={submitDisabled}
            >
              {pending ? "Working…" : mode === "login" ? "Sign in" : kind === "OWNER" ? "Create workspace" : "Create account"}
            </button>
            {providers.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-3 text-xs text-soft"><span className="h-px flex-1 bg-line" />or<span className="h-px flex-1 bg-line" /></div>
                {providers.map((p) => {
                  const label = p === "google" ? "Google" : "GitHub";
                  const icon = p === "google" ? <GoogleIcon className="h-4 w-4" /> : <GitHubIcon className="h-4 w-4" />;
                  if (mode === "login") return <a key={p} className="btn w-full" href={`/api/auth/oauth/${p}/start?mode=login`}>{icon}Continue with {label}</a>;
                  const needsCompany = kind === "OWNER" && f.workspaceName.trim().length < 2;
                  const go = () => {
                    const q = new URLSearchParams({ mode: "signup", terms: "1", kind, company: f.workspaceName.trim() });
                    try { const r = localStorage.getItem("oo-ref"); if (r) q.set("ref", r); } catch {}
                    const a = new URLSearchParams(window.location.search).get("address"); if (a) q.set("address", a);
                    window.location.href = `/api/auth/oauth/${p}/start?${q.toString()}`;
                  };
                  return <button key={p} type="button" className="btn w-full" disabled={!accept || needsCompany} title={!accept ? "Accept the terms first" : needsCompany ? "Enter your company name first" : undefined} onClick={go}>{icon}Sign up with {label}</button>;
                })}
                {mode === "register" && (
                  <p className="text-xs text-soft">
                    Tick the terms{kind === "OWNER" ? " and enter your company name" : ""} above first.
                    {kind === "OWNER" && " You’ll upload your company logo during first setup."}
                  </p>
                )}
              </div>
            )}
            {mode === "login" && <button type="button" className="btn w-full" onClick={() => setMagic(true)}>Email me a sign-in link instead</button>}
            {mode === "login" && <p className="text-xs text-soft">Company account? <Link className="text-accent" href="/sso">Sign in with single sign-on</Link></p>}
            <p className="text-xs text-soft">{mode === "login" ? <>New here? <Link className="text-accent" href="/register">Create an account</Link>. Employee? <Link className="text-accent" href="/staff">Find your workplace sign in</Link></> : <>Already have an account? <Link className="text-accent" href="/login">Sign in</Link></>}</p>
          </form>)}
        </div>
      </div>
    </div>
  );
}
