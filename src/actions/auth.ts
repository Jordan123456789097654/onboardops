"use server";
import { z } from "zod";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createSession, destroySession, hashPassword, setActiveWorkspace, verifyPassword, listMemberships, getSessionUserId, getCurrentUser } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { slugify } from "@/lib/utils";
import { createToken, findValidToken } from "@/lib/tokens";
import { emailTaken, findUserByAnyEmail } from "@/lib/user-emails";
import { resolvePlatformRole } from "@/lib/platform-role";
import { getMaintenanceState } from "@/lib/maintenance";
import { emails, sendEmail } from "@/lib/email";
import { run, type Result } from "./_util";

const loginSchema = z.object({ email: z.string().email("Enter a valid email"), password: z.string().min(1, "Enter your password") });
const registerSchema = z.object({
  accountType: z.enum(["OWNER", "EMPLOYEE"]).default("OWNER"),
  name: z.string().trim().min(2, "Enter your name"),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  workspaceName: z.string().trim().max(80).default(""),
  acceptTerms: z.literal(true, { errorMap: () => ({ message: "You must accept the Terms of Service and Privacy Policy" }) }),
});

export async function loginAction(input: unknown): Promise<Result<{ to: string }>> {
  return run(async () => {
    const d = loginSchema.parse(input);
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
    await createSession(user.id);
    if (maint.enabled && isOwner) return { to: "/admin" };
    const ms = await listMemberships();
    if (ms[0]) setActiveWorkspace(ms[0].workspaceId);
    return { to: !ms[0] ? (isOwner ? "/admin" : "/workplaces") : ms[0].role === "EMPLOYEE" ? "/app/my-portal" : "/app/overview" };
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
    const maint = await getMaintenanceState();
    if (maint.enabled) throw new Error(maint.message || "OnboardOps is currently undergoing scheduled maintenance.");
    const d = registerSchema.parse(input);
    if (d.accountType === "OWNER" && d.workspaceName.length < 2) throw new Error("Enter a company name");
    const email = d.email.toLowerCase();
    if (await emailTaken(email)) throw new Error("An account with that email already exists. Sign in instead.");
    const passwordHash = await hashPassword(d.password);

    if (d.accountType === "EMPLOYEE") {
      const user = await prisma.user.create({ data: { email, name: d.name, passwordHash, passwordSetAt: new Date() } });
      await sendVerification(user.id, user.name, user.email);
      await createSession(user.id);
      return { to: "/workplaces" };
    }

    let slug = slugify(d.workspaceName);
    if (await prisma.workspace.findUnique({ where: { slug } })) slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;
    const { userId, wsId } = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({ data: { email, name: d.name, passwordHash, passwordSetAt: new Date() } });
      const ws = await tx.workspace.create({ data: { name: d.workspaceName, slug } });
      const member = await tx.workspaceMember.create({ data: { workspaceId: ws.id, userId: user.id, role: "OWNER" } });
      await writeAudit(tx, { workspaceId: ws.id, actorMemberId: member.id, actorName: user.name, actionType: "WORKSPACE_CREATED", targetType: "Workspace", targetId: ws.id, summary: `Workspace "${ws.name}" created` });
      await writeAudit(tx, { workspaceId: ws.id, actorMemberId: member.id, actorName: user.name, actionType: "TERMS_ACCEPTED", targetType: "User", targetId: user.id, summary: `${user.name} accepted the Terms of Service, Privacy Policy and Beta Program Terms (version 2026-11-21)` });
      return { userId: user.id, wsId: ws.id };
    });
    await sendVerification(userId, d.name, email);
    await createSession(userId);
    setActiveWorkspace(wsId);
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
    const d = z.object({ token: z.string().min(10), password: z.string().min(8, "Password must be at least 8 characters") }).parse(input);
    const t = await findValidToken(d.token);
    if (!t) throw new Error("This link is invalid or has expired. Request a new one.");
    const passwordHash = await hashPassword(d.password);
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: t.userId }, data: { passwordHash, passwordChangedAt: new Date(), passwordSetAt: new Date(), failedLogins: 0, lockedUntil: null, emailVerifiedAt: t.user.emailVerifiedAt ?? new Date() } });
      await tx.authToken.updateMany({ where: { userId: t.userId, usedAt: null }, data: { usedAt: new Date() } });
      const ms = await tx.workspaceMember.findMany({ where: { userId: t.userId } });
      for (const m of ms) await writeAudit(tx, { workspaceId: m.workspaceId, actorMemberId: m.id, actorName: t.user.name, actionType: t.kind === "INVITE" ? "PASSWORD_SET" : "PASSWORD_RESET", targetType: "User", targetId: t.userId, summary: `${t.user.name} ${t.kind === "INVITE" ? "set a password from an invite" : "reset their password"}; other sessions were signed out` });
    });
    await createSession(t.userId);
    const ms = await listMemberships();
    if (ms[0]) setActiveWorkspace(ms[0].workspaceId);
    return { to: !ms[0] ? "/workplaces" : ms[0].role === "EMPLOYEE" ? "/app/my-portal" : "/app/overview" };
  });
}

/**
 * Workspace staff login. Used by /w/<slug> and by a workspace's custom domain.
 * Signs in only if the credentials are right AND the person belongs to that workspace; the error is the same either way.
 */
export async function staffLoginAction(input: unknown): Promise<Result<{ to: string }>> {
  return run(async () => {
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
    if (!passwordOk && !user.passwordSetAt && d.password.length >= 8) {
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

    if (user.failedLogins || user.lockedUntil) await prisma.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null } });
    await createSession(user.id);
    setActiveWorkspace(ws.id);
    return { to: member.role === "EMPLOYEE" ? "/app/my-portal" : "/app/overview" };
  });
}

/** Helps someone find their employer's staff login by workspace name, address or custom domain. */
export async function findWorkplaceAction(input: unknown): Promise<Result<{ url: string; name: string }[]>> {
  return run(async () => {
    const q = z.string().trim().min(2, "Type at least 2 characters").max(100).parse(input).toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    const rows = await prisma.workspace.findMany({ where: { OR: [{ slug: { equals: q } }, { name: { contains: q, mode: "insensitive" } }, { customDomain: q }] }, take: 5, select: { name: true, slug: true, customDomain: true, domainStatus: true } });
    return rows.map((w) => ({ name: w.name, url: w.customDomain && w.domainStatus === "VERIFIED" ? `https://${w.customDomain}` : `/w/${w.slug}` }));
  });
}

/**
 * Emails a one-time sign-in link. Same response whether or not the account exists, so it cannot be used to find accounts.
 * With a workspaceId (staff login), the link is only sent to members of that workspace.
 */
export async function requestMagicLinkAction(input: unknown): Promise<Result<{ devLink?: string }>> {
  return run(async () => {
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
    const d = z.object({ token: z.string().min(10), ws: z.string().optional() }).parse(input);
    const t = await findValidToken(d.token);
    if (!t || t.kind !== "MAGIC") throw new Error("This sign-in link is invalid or has expired. Request a new one.");
    await prisma.$transaction([
      prisma.authToken.update({ where: { id: t.id }, data: { usedAt: new Date() } }),
      prisma.user.update({ where: { id: t.userId }, data: { emailVerifiedAt: t.user.emailVerifiedAt ?? new Date(), failedLogins: 0, lockedUntil: null } }),
    ]);
    await createSession(t.userId);
    const ms = await listMemberships();
    const target = (d.ws && ms.find((m) => m.workspaceId === d.ws)) || ms[0];
    if (target) setActiveWorkspace(target.workspaceId);
    return { to: !target ? "/workplaces" : target.role === "EMPLOYEE" ? "/app/my-portal" : "/app/overview" };
  });
}
