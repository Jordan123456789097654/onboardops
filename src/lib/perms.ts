import type { Role } from "@prisma/client";

/**
 * Fine-grained permissions that can be granted on top of a role.
 * Owners and Admins always have everything. Built-in roles start with the defaults below, and a workspace can add more
 * (Settings, Roles) or create custom roles. A custom role has a base level (Employee, Supervisor or Manager) plus extra grants.
 */
export type Perm = { key: string; label: string; group: string; defaults: Role[] };

export const PERMS: Perm[] = [
  { key: "training.build", group: "Training", label: "Build and edit courses and quizzes", defaults: ["MANAGER"] },
  { key: "training.assign", group: "Training", label: "Assign courses to employees", defaults: ["MANAGER"] },
  { key: "checklists.manage", group: "Checklists", label: "Create and edit checklist templates", defaults: ["MANAGER"] },
  { key: "checklists.verify", group: "Checklists", label: "Verify completed checklists", defaults: ["MANAGER", "SUPERVISOR"] },
  { key: "incidents.review", group: "Incidents", label: "Review incident reports and add corrective actions", defaults: ["MANAGER"] },
  { key: "requests.decide", group: "Requests", label: "Approve or deny leave and time-off requests", defaults: ["MANAGER"] },
  { key: "reports.view", group: "Reports", label: "View reports", defaults: ["MANAGER"] },
  { key: "documents.manage", group: "Records", label: "Upload and open employee documents", defaults: ["MANAGER"] },
  { key: "credentials.manage", group: "Records", label: "Manage employee credentials and licenses", defaults: ["MANAGER"] },
  { key: "roster.view", group: "Records", label: "View and export the emergency roster", defaults: ["MANAGER", "SUPERVISOR"] },
  { key: "policies.manage", group: "Policies", label: "Create and publish policies", defaults: ["MANAGER"] },
  { key: "schedule.manage", group: "Shifts", label: "Build the schedule and approve swaps", defaults: ["MANAGER", "SUPERVISOR"] },
  { key: "timesheets.view", group: "Shifts", label: "View and export timesheets", defaults: ["MANAGER"] },
  { key: "assets.manage", group: "Shifts", label: "Manage equipment and sign-outs", defaults: ["MANAGER", "SUPERVISOR"] },
];

export const PERM_KEYS = PERMS.map((p) => p.key);

type RolePerms = Record<string, string[]>;
type Ctxish = { role: Role; customRoleId?: string | null; workspace: { rolePerms: unknown } };

/** Every permission this member has. */
export function permsOf(m: Ctxish): Set<string> {
  if (m.role === "OWNER" || m.role === "ADMIN") return new Set(PERM_KEYS);
  const grants = (m.workspace.rolePerms ?? {}) as RolePerms;
  const out = new Set<string>(PERMS.filter((p) => p.defaults.includes(m.role)).map((p) => p.key));
  for (const k of grants[m.role] ?? []) out.add(k);
  if (m.customRoleId) for (const k of grants[`custom:${m.customRoleId}`] ?? []) out.add(k);
  return out;
}

export const can = (m: Ctxish, perm: string) => permsOf(m).has(perm);
