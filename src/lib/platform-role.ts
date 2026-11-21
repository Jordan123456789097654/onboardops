export type PlatformRole = "OWNER" | "SUPPORT" | "VIEWER";
export const PLATFORM_ROLES: PlatformRole[] = ["OWNER", "SUPPORT", "VIEWER"];

/** Resolves a user's staff role: the stored role, or OWNER if the email is listed in PLATFORM_OWNER_EMAILS (bootstrap). */
export function resolvePlatformRole(user: { email: string; platformRole: string | null; emailVerifiedAt?: Date | null }): PlatformRole | null {
  if (!user.emailVerifiedAt) return null; // an unverified email never grants staff access
  const boot = (process.env.PLATFORM_OWNER_EMAILS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (boot.includes(user.email.toLowerCase())) return "OWNER";
  return PLATFORM_ROLES.includes(user.platformRole as PlatformRole) ? (user.platformRole as PlatformRole) : null;
}
