/** Email kinds a person can switch off. Sign-in, security and account emails are never optional. */
export const OPTIONAL_EMAIL_KINDS: { kind: string; label: string; hint: string }[] = [
  { kind: "cases", label: "Infractions and appeals", hint: "New cases and appeal decisions about you" },
  { kind: "courses", label: "Training", hint: "Course assignments, retraining and reminders" },
  { kind: "policies", label: "Policy sign requests", hint: "New or updated policies you need to sign" },
  { kind: "request-decision", label: "Request decisions", hint: "Time off, leave and profile update outcomes" },
  { kind: "checklists", label: "Checklists", hint: "Checklist reminders and verifications" },
  { kind: "operations", label: "Schedule and shift swaps", hint: "Shift changes and swap outcomes" },
];

export function emailOptedOut(prefs: unknown, kind: string | undefined): boolean {
  if (!kind || !OPTIONAL_EMAIL_KINDS.some((k) => k.kind === kind)) return false;
  const m = (prefs ?? {}) as Record<string, unknown>;
  return m[kind] === false;
}
