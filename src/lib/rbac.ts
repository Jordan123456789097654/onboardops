import { redirect } from "next/navigation";
import type { Role, Severity } from "@prisma/client";
import { getActiveMembership, unauthPath, type Membership } from "./auth";
import { can } from "./perms";
import { featureOn } from "./features";
import { isWorkspaceLocked } from "./cmk";

export class AuthzError extends Error {
  constructor(message = "You do not have permission to do that.") {
    super(message);
    this.name = "AuthzError";
  }
}

export const ADMIN_ROLES: Role[] = ["OWNER", "ADMIN"];
export const MANAGEMENT_ROLES: Role[] = ["OWNER", "ADMIN", "MANAGER"];
export const STAFF_ROLES: Role[] = ["OWNER", "ADMIN", "MANAGER", "SUPERVISOR"];
export const ALL_ROLES: Role[] = ["OWNER", "ADMIN", "MANAGER", "SUPERVISOR", "EMPLOYEE"];

export type Ctx = Membership;

/** The workspace requires two-factor sign-in and this member has not set it up yet (staff support access is exempt). */
export const mfaBlocked = (m: Ctx) => !m.support && m.workspace.require2fa && !m.user.totpEnabledAt;
const MFA_REQUIRED = "Your workspace requires two-factor authentication. Turn it on in Account settings, then come back.";

/** For server actions / route handlers: throws AuthzError. */
export async function requireWorkspaceRole(allowed: Role[], opts?: { allowSuspended?: boolean; allowLocked?: boolean }): Promise<Ctx> {
  const m = await getActiveMembership();
  if (!m) throw new AuthzError("Not signed in.");
  if (m.support) throw new AuthzError("Support access is read-only.");
  if (m.workspace.suspendedAt && !opts?.allowSuspended) throw new AuthzError("This workspace is locked by OnboardOps. Contact support to resolve it.");
  if (mfaBlocked(m)) throw new AuthzError(MFA_REQUIRED);
  if (!opts?.allowLocked && (await isWorkspaceLocked(m.workspace))) throw new AuthzError("This workspace's encryption key was revoked, so its records are locked. The owner can unlock it by providing the key.");
  if (!allowed.includes(m.role)) throw new AuthzError();
  return m;
}

/** For pages: redirects instead of throwing. */
export async function requirePageRole(allowed: Role[]): Promise<Ctx> {
  const m = await getActiveMembership();
  if (!m) redirect(await unauthPath());
  if (mfaBlocked(m)) redirect("/account?need2fa=1");
  if (!allowed.includes(m.role)) redirect(m.role === "EMPLOYEE" ? "/app/my-portal" : "/app/overview");
  return m;
}

export function canIssueSeverity(role: Role, severity: Severity) {
  if (role === "OWNER" || role === "ADMIN") return true;
  if (role === "MANAGER") return severity !== "TERMINATION";
  if (role === "SUPERVISOR") return severity === "VERBAL_WARNING" || severity === "WRITTEN_INFRACTION";
  return false;
}

export function canSeeConfidential(role: Role) {
  return role === "OWNER" || role === "ADMIN" || role === "MANAGER";
}

type CaseLike = {
  confidentialManagerNotes: string;
  timeline?: { isConfidential: boolean; note: string }[];
  [k: string]: any;
};

/** Single choke point for removing HR-confidential fields before data leaves the server. */
export function serializeInfraction<T extends CaseLike>(role: Role, c: T): T {
  if (canSeeConfidential(role)) return c;
  const copy: any = { ...c, confidentialManagerNotes: "" };
  if (c.timeline) copy.timeline = c.timeline.filter((e) => !e.isConfidential);
  return copy;
}

export function visibleTo(role: Role) {
  return {
    seeAudit: role === "OWNER" || role === "ADMIN",
    seeSettings: role === "OWNER" || role === "ADMIN",
    seeDirectory: role !== "EMPLOYEE",
    seeInfractions: role !== "EMPLOYEE",
    buildCourses: MANAGEMENT_ROLES.includes(role),
    manageStaff: MANAGEMENT_ROLES.includes(role),
  };
}

export function hasFeature(m: Ctx, key: string) {
  return featureOn(m.workspace.features, key);
}

/** For server actions: the member must hold the permission (and the feature, if given, must be switched on). */
export async function requirePerm(perm: string, feature?: string, opts?: { allowSuspended?: boolean }): Promise<Ctx> {
  const m = await requireWorkspaceRole(["OWNER", "ADMIN", "MANAGER", "SUPERVISOR", "EMPLOYEE"], opts);
  if (feature && !hasFeature(m, feature)) throw new AuthzError("This feature is turned off for the workspace.");
  if (!can(m, perm)) throw new AuthzError();
  return m;
}

/** For server actions available to any signed-in member when a feature is on. */
export async function requireFeature(feature: string): Promise<Ctx> {
  const m = await requireWorkspaceRole(["OWNER", "ADMIN", "MANAGER", "SUPERVISOR", "EMPLOYEE"]);
  if (!hasFeature(m, feature)) throw new AuthzError("This feature is turned off for the workspace.");
  return m;
}

/** For pages: redirects away when the member lacks the permission or the feature is off. */
export async function requirePagePerm(perm: string | null, feature?: string): Promise<Ctx> {
  const m = await requirePageRole(["OWNER", "ADMIN", "MANAGER", "SUPERVISOR", "EMPLOYEE"]);
  if ((feature && !hasFeature(m, feature)) || (perm && !can(m, perm))) redirect(m.role === "EMPLOYEE" ? "/app/my-portal" : "/app/overview");
  return m;
}

/** For pages that need a role and a feature switched on. */
export async function requirePageRoleFeature(allowed: Role[], feature: string): Promise<Ctx> {
  const m = await requirePageRole(allowed);
  if (!hasFeature(m, feature)) redirect(m.role === "EMPLOYEE" ? "/app/my-portal" : "/app/overview");
  return m;
}
