"use server";
import { z } from "zod";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createSession, destroySession, hashPassword, setActiveWorkspace, verifyPassword, listMemberships, membershipsFor, getSessionUserId, getCurrentUser } from "@/lib/auth";
import { beginSession, landingFor } from "@/lib/login";
import { hasOAuthAccount } from "@/lib/oauth";
import { ssoRequiredFor } from "@/lib/sso";
import { samlRequiredFor } from "@/lib/saml";
import { writeAudit } from "@/lib/audit";
import { slugify } from "@/lib/utils";
import { createToken, findValidToken } from "@/lib/tokens";
import { emailTaken, findUserByAnyEmail } from "@/lib/user-emails";
import { resolvePlatformRole } from "@/lib/platform-role";
import { getMaintenanceState } from "@/lib/maintenance";
import { emails, sendEmail } from "@/lib/email";
import { enforceRate } from "@/lib/rate-limit";
import { autoClaimSubdomain, subdomainHost } from "@/lib/subdomain";
import { parseLogoDataUrl } from "@/lib/logo";
import { rejectBreachedPassword } from "@/lib/pwned";
import { run, type Result } from "./_util";

const loginSchema = z.object({ email: z.string().email("Enter a valid email"), password: z.string().min(1, "Enter your password") });
const registerSchema = z.object({
  accountType: z.enum(["OWNER", "EMPLOYEE", "ACCOUNT"]).default("OWNER"),
  name: z.string().trim().min(2, "Enter your name"),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  workspaceName: z.string().trim().max(80).default(""),
  logoDataUrl: z.string().optional(),
  ref: z.string().max(40).optional(),
  address: z.string().max(60).optional(),
  acceptTerms: z.literal(true, { errorMap: () => ({ message: "You must accept the Terms of Service and Privacy Policy" }) }),
});

export async function loginAction(input: unknown): Promise<Result<{ to: string }>> {
  return run(async () => {
    await enforceRate("login", 20, 900);
    const d = loginSchema.parse(input);
    // A company that requires single sign-on sends its members to their identity provider; the password is not accepted for them (owners are exempt).
    if (await ssoRequiredFor(d.email)) return { to: `/api/auth/sso/start?email=${encodeURIComponent(d.email.trim().toLowerCase())}` };
    if (await samlRequiredFor(d.email)) return { to: `/api/auth/saml/start?email=${encodeURIComponent(d.email.trim().toLowerCase())}` };
    const user = await findUserByAnyEmail(d.email);
    if (user?.lockedUntil && user.lockedUntil > new Date()) throw new Error("Too many failed attempts. Try again in a few minutes, or reset your password.");
    if (!user || !(await verifyPassword(d.password, user.passwordHash))) {
      if (user) {
        const fails = user.failedLogins + 1;
        await prisma.user.update({ where: { id: user.id }, data: fails >= 5 ? { failedLogins: 0, lockedUntil: new Date(Date.now() + 15 * 60000) } : { failedLogins: fails } });
      }
      throw new Error("Email or password is incorrect.");
    }
    const maint = await getMaintenanceState();
    const isOwner = resolvePlatformRole(user) === "OWNER";
    if (maint.enabled && !isOwner) {
      throw new Error(maint.message || "OnboardOps is currently undergoing scheduled maintenance.");
    }
    if (user.failedLogins || user.lockedUntil) await prisma.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null } });
    const first = (await membershipsFor(user.id))[0];
    const gate = await beginSession(user.id, { workspaceId: first?.workspaceId, method: "password" });
    if (!gate.done) return { to: gate.to };
    if (maint.enabled && isOwner) return { to: "/admin" };
    return { to: await landingFor(user.id, first?.workspaceId) };
  });
}

async function sendVerification(userId: string, name: string, email: string) {
  const raw = await createToken(userId, "VERIFY", 24 * 3600_000);
  const url = `${process.env.APP_URL || "https://onboardops.org"}/verify-email?token=${raw}`;
  const m = emails.verify(name, url);
  const r = await sendEmail(email, m.subject, m.text, { html: m.html, kind: "verify" });
  return { sent: r.ok, devLink: process.env.NODE_ENV !== "production" ? url : undefined };
}

export async function registerAction(input: unknown): Promise<Result<{ to: string }>> {
  return run(async () => {
    await enforceRate("register", 10, 3600);
    const maint = await getMaintenanceState();
    if (maint.enabled) throw new Error(maint.message || "OnboardOps is currently undergoing scheduled maintenance.");
    const d = registerSchema.parse(input);
    if (d.accountType === "OWNER" && d.workspaceName.length < 2) throw new Error("Enter a company name");
    let parsedLogo: ReturnType<typeof parseLogoDataUrl> | null = null;
    // The logo is optional: owners can add it later in settings.
    if (d.accountType === "OWNER" && d.logoDataUrl) parsedLogo = parseLogoDataUrl(d.logoDataUrl);
    const email = d.email.toLowerCase();
    if (await emailTaken(email)) throw new Error("An account with that email already exists. Sign in instead.");
    await rejectBreachedPassword(d.password);
    const passwordHash = await hashPassword(d.password);

    if (d.accountType !== "OWNER") {
      const user = await prisma.user.create({ data: { email, name: d.name, passwordHash, passwordSetAt: new Date() } });
      await sendVerification(user.id, user.name, user.email);
      await createSession(user.id);
      return { to: "/workplaces" };
    }

    let slug = slugify(d.workspaceName);
    if (await prisma.workspace.findUnique({ where: { slug } })) slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;
    const { userId, wsId } = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({ data: { email, name: d.name, passwordHash, passwordSetAt: new Date() } });
      const ws = await tx.workspace.create({
        data: {
          name: d.workspaceName,
          slug,
          ...(parsedLogo ? { logoData: parsedLogo.data, logoMime: parsedLogo.mime, logoUpdatedAt: new Date() } : {}),
        },
      });
      const member = await tx.workspaceMember.create({ data: { workspaceId: ws.id, userId: user.id, role: "OWNER" } });
      await writeAudit(tx, { workspaceId: ws.id, actorMemberId: member.id, actorName: user.name, actionType: "WORKSPACE_CREATED", targetType: "Workspace", targetId: ws.id, summary: `Workspace "${ws.name}" created` });
      await writeAudit(tx, { workspaceId: ws.id, actorMemberId: member.id, actorName: user.name, actionType: "TERMS_ACCEPTED", targetType: "User", targetId: user.id, summary: `${user.name} accepted the Terms of Service, Privacy Policy and Beta Program Terms (version 2026-11-21)` });
      return { userId: user.id, wsId: ws.id };
    });
    await sendVerification(userId, d.name, email);
    await createSession(userId);
    setActiveWorkspace(wsId);
    if (d.ref && /^[a-z0-9-]{3,30}$/i.test(d.ref)) {
      const partner = await prisma.partner.findUnique({ where: { code: d.ref.toLowerCase() } });
      if (partner) await prisma.workspace.update({ where: { id: wsId }, data: { referralCode: partner.code } }).catch(() => {});
    }
    const claimed = d.address ? await autoClaimSubdomain(wsId, d.address) : null;
    if (!claimed) await autoClaimSubdomain(wsId, slug);
    return { to: "/app/overview" };
  });
}

/** Confirms an email address from the emailed link. Works without being signed in. */
export async function verifyEmailAction(token: string, emailId?: string): Promise<Result<{ signedIn: boolean }>> {
  return run(async () => {
    const t = await findValidToken(token);
    if (t && t.kind === "ADDEMAIL" && emailId) {
      const row = await prisma.userEmail.findFirst({ where: { id: emailId, userId: t.userId } });
      if (!row) throw new Error("That address was removed from the account.");
      await prisma.$transaction([prisma.userEmail.update({ where: { id: row.id }, data: { verifiedAt: new Date() } }), prisma.authToken.update({ where: { id: t.id }, data: { usedAt: new Date() } })]);
      return { signedIn: (await getSessionUserId(false)) === t.userId };
    }
    if (!t || t.kind !== "VERIFY") throw new Error("This link is invalid or has expired. Request a new one from your account.");
    await prisma.$transaction([
      prisma.user.update({ where: { id: t.userId }, data: { emailVerifiedAt: new Date() } }),
      prisma.authToken.update({ where: { id: t.id }, data: { usedAt: new Date() } }),
    ]);
    const uid = await getSessionUserId(false);
    return { signedIn: uid === t.userId };
  });
}

export async function resendVerificationAction(): Promise<Result<{ devLink?: string }>> {
  return run(async () => {
    const user = await getCurrentUser();
    if (!user) throw new Error("Sign in first.");
    if (user.emailVerifiedAt) throw new Error("Your email is already verified.");
    const recent = await prisma.authToken.count({ where: { userId: user.id, kind: "VERIFY", createdAt: { gt: new Date(Date.now() - 3600_000) } } });
    if (recent >= 3) throw new Error("We already sent several links. Check your inbox and spam folder, then try again later.");
    const r = await sendVerification(user.id, user.name, user.email);
    return { devLink: r.devLink };
  });
}

export async function logoutAction() {
  destroySession();
  redirect("/");
}

export async function switchWorkspaceAction(workspaceId: string) {
  const ms = await listMemberships();
  const m = ms.find((x) => x.workspaceId === workspaceId);
  if (!m) return;
  setActiveWorkspace(workspaceId);
  redirect(m.role === "EMPLOYEE" ? "/app/my-portal" : "/app/overview");
}

export async function forgotPasswordAction(input: unknown): Promise<Result<{ devLink?: string }>> {
  return run(async () => {
    await enforceRate("forgot", 6, 900);
    const { email } = z.object({ email: z.string().email("Enter a valid email") }).parse(input);
    const user = await findUserByAnyEmail(email);
    let devLink: string | undefined;
    if (user) {
      const recent = await prisma.authToken.count({ where: { userId: user.id, kind: "RESET", createdAt: { gt: new Date(Date.now() - 3600_000) } } });
      if (recent < 3) {
        const raw = await createToken(user.id, "RESET", 3600_000);
        const url = `${process.env.APP_URL || "http://localhost:3000"}/reset-password?token=${raw}`;
        const m = emails.reset(user.name, url);
        await sendEmail(user.email, m.subject, m.text, { html: m.html });
        if (process.env.NODE_ENV !== "production") devLink = url;
      }
    }
    // Same response whether or not the account exists, so this cannot be used to find accounts.
    return { devLink };
  });
}

export async function resetPasswordAction(input: unknown): Promise<Result<{ to: string }>> {
  return run(async () => {
    await enforceRate("reset", 10, 900);
    const d = z.object({ token: z.string().min(10), password: z.string().min(8, "Password must be at least 8 characters") }).parse(input);
    const t = await findValidToken(d.token);
    if (!t) throw new Error("This link is invalid or has expired. Request a new one.");
    await rejectBreachedPassword(d.password);
    const passwordHash = await hashPassword(d.password);
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: t.userId }, data: { passwordHash, passwordChangedAt: new Date(), passwordSetAt: new Date(), failedLogins: 0, lockedUntil: null, emailVerifiedAt: t.user.emailVerifiedAt ?? new Date() } });
      await tx.authToken.updateMany({ where: { userId: t.userId, usedAt: null }, data: { usedAt: new Date() } });
      const ms = await tx.workspaceMember.findMany({ where: { userId: t.userId } });
      for (const m of ms) await writeAudit(tx, { workspaceId: m.workspaceId, actorMemberId: m.id, actorName: t.user.name, actionType: t.kind === "INVITE" ? "PASSWORD_SET" : "PASSWORD_RESET", targetType: "User", targetId: t.userId, summary: `${t.user.name} ${t.kind === "INVITE" ? "set a password from an invite" : "reset their password"}; other sessions were signed out` });
    });
    // A reset link proves the email, not the second factor, so it goes through the same gate as a password sign-in.
    if ((await ssoRequiredFor(t.user.email)) || (await samlRequiredFor(t.user.email))) return { to: "/sso" };
    const first = (await membershipsFor(t.userId))[0];
    const gate = await beginSession(t.userId, { workspaceId: first?.workspaceId, method: "reset" });
    if (!gate.done) return { to: gate.to };
    return { to: await landingFor(t.userId, first?.workspaceId, "/workplaces") };
  });
}

/**
 * Workspace staff login. Used by /w/<slug> and by a workspace's custom domain.
 * Signs in only if the credentials are right AND the person belongs to that workspace; the error is the same either way.
 */
export async function staffLoginAction(input: unknown): Promise<Result<{ to: string }>> {
  return run(async () => {
    await enforceRate("stafflogin", 20, 900);
    const d = z.object({ workspaceId: z.string().min(1), email: z.string().email("Enter a valid email"), password: z.string().min(1, "Enter your password") }).parse(input);
    const generic = "Email or password is incorrect, or you are not part of this workplace.";
    const ws = await prisma.workspace.findUnique({ where: { id: d.workspaceId } });
    if (!ws) throw new Error(generic);
    const cleanEmail = d.email.trim().toLowerCase();
    let user = await findUserByAnyEmail(cleanEmail);
    const emp = await prisma.employeeProfile.findFirst({
      where: { workspaceId: ws.id, email: { equals: cleanEmail, mode: "insensitive" }, status: { not: "TERMINATED" } },
    });

    // If an employee record exists for this email in the workspace, but no User account exists yet, create their User account with their chosen password (8+ chars)
    if (!user && emp) {
      if (d.password.length < 8) throw new Error("First time signing in? Choose a password of at least 8 characters.");
      user = await prisma.user.create({
        data: {
          email: cleanEmail,
          name: emp.fullName,
          passwordHash: await hashPassword(d.password),
          passwordSetAt: new Date(),
          emailVerifiedAt: new Date(),
        },
      });
    }

    if (user?.lockedUntil && user.lockedUntil > new Date()) throw new Error("Too many failed attempts. Try again in a few minutes, or reset your password.");
    if (!user) throw new Error(generic);

    // If the user was created by an invite link (!user.passwordSetAt) and hasn't set a password yet, let their first sign-in set their password
    let passwordOk = await verifyPassword(d.password, user.passwordHash);
    // An account created through Google or GitHub has a random password nobody knows. It must not be claimable by whoever types a password first.
    if (!passwordOk && !user.passwordSetAt && d.password.length >= 8 && !(await hasOAuthAccount(user.id))) {
      const newHash = await hashPassword(d.password);
      user = await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: newHash, passwordSetAt: new Date(), emailVerifiedAt: user.emailVerifiedAt ?? new Date() },
      });
      passwordOk = true;
    }

    if (!passwordOk) {
      const fails = user.failedLogins + 1;
      await prisma.user.update({ where: { id: user.id }, data: fails >= 5 ? { failedLogins: 0, lockedUntil: new Date(Date.now() + 15 * 60000) } : { failedLogins: fails } });
      throw new Error(generic);
    }

    let member = await prisma.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId: ws.id, userId: user.id } } });
    // Auto-link if they have a matching EmployeeProfile in this workspace or are a platform OWNER
    if (!member && (emp || resolvePlatformRole(user) === "OWNER")) {
      const defaultRole = resolvePlatformRole(user) === "OWNER" && !emp ? "ADMIN" : "EMPLOYEE";
      member = await prisma.workspaceMember.create({
        data: { workspaceId: ws.id, userId: user.id, role: defaultRole },
      });
      if (emp && !emp.memberId) {
        await prisma.employeeProfile.update({ where: { id: emp.id }, data: { memberId: member.id } });
      }
    } else if (member && emp && !emp.memberId) {
      await prisma.employeeProfile.update({ where: { id: emp.id }, data: { memberId: member.id } });
    }

    if (!member) throw new Error(generic);
    if (member.role !== "OWNER" && (await ssoRequiredFor(user.email))?.workspaceId === ws.id) return { to: `/api/auth/sso/start?email=${encodeURIComponent(user.email)}` };
    if (member.role !== "OWNER" && (await samlRequiredFor(user.email))?.workspaceId === ws.id) return { to: `/api/auth/saml/start?email=${encodeURIComponent(user.email)}` };

    if (user.failedLogins || user.lockedUntil) await prisma.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null } });
    const gate = await beginSession(user.id, { workspaceId: ws.id, method: "staff" });
    if (!gate.done) return { to: gate.to };
    setActiveWorkspace(ws.id);
    return { to: member.role === "EMPLOYEE" ? "/app/my-portal" : "/app/overview" };
  });
}

/** Helps someone find their employer's staff login by workspace name, address or custom domain. */
export async function findWorkplaceAction(input: unknown): Promise<Result<{ url: string; name: string }[]>> {
  return run(async () => {
    await enforceRate("findws", 30, 600);
    const q = z.string().trim().min(2, "Type at least 2 characters").max(100).parse(input).toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    const rows = await prisma.workspace.findMany({ where: { OR: [{ slug: { equals: q } }, { name: { contains: q, mode: "insensitive" } }, { customDomain: q }, { subdomain: q.replace(/\.onboardops\.org$/, "") }] }, take: 5, select: { name: true, slug: true, customDomain: true, domainStatus: true, subdomain: true, subdomainStatus: true } });
    return rows.map((w) => ({ name: w.name, url: w.customDomain && w.domainStatus === "VERIFIED" ? `https://${w.customDomain}` : w.subdomain && w.subdomainStatus === "ACTIVE" ? `https://${subdomainHost(w.subdomain)}` : `/w/${w.slug}` }));
  });
}

/**
 * Emails a one-time sign-in link. Same response whether or not the account exists, so it cannot be used to find accounts.
 * With a workspaceId (staff login), the link is only sent to members of that workspace.
 */
export async function requestMagicLinkAction(input: unknown): Promise<Result<{ devLink?: string }>> {
  return run(async () => {
    await enforceRate("magic", 6, 900);
    const d = z.object({ email: z.string().email("Enter a valid email"), workspaceId: z.string().optional() }).parse(input);
    const user = await prisma.user.findUnique({ where: { email: d.email.toLowerCase() } });
    let devLink: string | undefined;
    if (user) {
      const ws = d.workspaceId ? await prisma.workspace.findUnique({ where: { id: d.workspaceId } }) : null;
      const member = ws ? await prisma.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId: ws.id, userId: user.id } } }) : null;
      if (!d.workspaceId || member) {
        const recent = await prisma.authToken.count({ where: { userId: user.id, kind: "MAGIC", createdAt: { gt: new Date(Date.now() - 3600_000) } } });
        if (recent < 4) {
          const raw = await createToken(user.id, "MAGIC", 15 * 60_000);
          const url = `${process.env.APP_URL || "http://localhost:3000"}/magic?token=${raw}${ws ? `&ws=${ws.id}` : ""}`;
          const m = emails.magicLink(user.name, url, ws?.name);
          await sendEmail(d.email.toLowerCase(), m.subject, m.text, { html: m.html, kind: "magic-link", workspaceId: ws?.id });
          if (process.env.NODE_ENV !== "production") devLink = url;
        }
      }
    }
    return { devLink };
  });
}

/** Called when the person presses the button on the /magic page. A button (not a GET) keeps email scanners from using up the link. */
export async function magicSignInAction(input: unknown): Promise<Result<{ to: string }>> {
  return run(async () => {
    await enforceRate("magicin", 20, 900);
    const d = z.object({ token: z.string().min(10), ws: z.string().optional() }).parse(input);
    const t = await findValidToken(d.token);
    if (!t || t.kind !== "MAGIC") throw new Error("This sign-in link is invalid or has expired. Request a new one.");
    if ((await ssoRequiredFor(t.user.email)) || (await samlRequiredFor(t.user.email))) throw new Error("Your company requires single sign-on. Use the single sign-on link on the sign-in page.");
    await prisma.$transaction([
      prisma.authToken.update({ where: { id: t.id }, data: { usedAt: new Date() } }),
      prisma.user.update({ where: { id: t.userId }, data: { emailVerifiedAt: t.user.emailVerifiedAt ?? new Date(), failedLogins: 0, lockedUntil: null } }),
    ]);
    const ms = await membershipsFor(t.userId);
    const target = (d.ws && ms.find((m) => m.workspaceId === d.ws)) || ms[0];
    // A sign-in link proves the email, not the second factor, so it goes through the same gate as a password sign-in.
    const gate = await beginSession(t.userId, { workspaceId: target?.workspaceId, method: "magic" });
    if (!gate.done) return { to: gate.to };
    return { to: await landingFor(t.userId, target?.workspaceId, "/workplaces") };
  });
}
