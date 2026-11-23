/** What an API key may do. Read and write are separate scopes; a key gets only the ones ticked when it is created. */
export const SCOPES = ["employees:read", "employees:write", "shifts:read", "shifts:write", "courses:assign", "infractions:write", "audit:read"] as const;
export type Scope = (typeof SCOPES)[number];

export const SCOPE_INFO: Record<Scope, { label: string; hint: string }> = {
  "employees:read": { label: "Read employees", hint: "List and fetch employees" },
  "employees:write": { label: "Write employees", hint: "Create and update employees, change status" },
  "shifts:read": { label: "Read shifts", hint: "List shifts" },
  "shifts:write": { label: "Create shifts", hint: "Create shifts" },
  "courses:assign": { label: "Assign courses", hint: "Assign a course to employees" },
  "infractions:write": { label: "Log infractions", hint: "Verbal warnings, written infractions and strike points only" },
  "audit:read": { label: "Read audit log", hint: "List audit entries" },
};

export const DEFAULT_SCOPES: Scope[] = ["employees:read", "shifts:read"];
export const isScope = (s: string): s is Scope => (SCOPES as readonly string[]).includes(s);
export const isWriteScope = (s: string) => s === "employees:write" || s === "shifts:write" || s === "courses:assign" || s === "infractions:write";
