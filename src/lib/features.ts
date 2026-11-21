/** Workspace feature toggles. Owners and Admins switch these in Settings, Features. */
export type Feature = { key: string; label: string; description: string; group: string; defaultOn: boolean };

export const FEATURES: Feature[] = [
  // Core records
  { key: "incidents", group: "Records and people", label: "Incident reports", description: "Anyone can report near misses, hazards and concerns. Managers review them and can turn them into cases.", defaultOn: true },
  { key: "requests", group: "Records and people", label: "Leave, retirement and resignation requests", description: "Employees send requests from their portal; managers decide.", defaultOn: true },
  { key: "timeOff", group: "Records and people", label: "Time-off requests", description: "Vacation, sick and personal time requests, beyond leave of absence.", defaultOn: true },
  { key: "selfService", group: "Records and people", label: "Employee profile updates", description: "Employees request changes to their phone and emergency contact, and a manager approves them.", defaultOn: true },
  { key: "customFields", group: "Records and people", label: "Custom fields on employee records", description: "Add your own fields, such as locker number or uniform size.", defaultOn: true },
  { key: "documents", group: "Records and people", label: "Employee documents", description: "Store licenses and signed forms with restricted access.", defaultOn: true },
  { key: "credentials", group: "Records and people", label: "Credentials and license tracking", description: "Track licenses and certifications with expiry alerts across all staff.", defaultOn: true },
  { key: "roster", group: "Records and people", label: "Emergency roster", description: "A printable and exportable list of staff and emergency contacts.", defaultOn: true },
  { key: "reviews", group: "Records and people", label: "Reviews and 1:1 notes", description: "Private manager notes with optional sharing.", defaultOn: true },
  // Training and policy
  { key: "policies", group: "Training and policy", label: "Policies and acknowledgments", description: "Publish policies and track who signed, with optional re-acknowledgment.", defaultOn: true },
  { key: "templates", group: "Training and policy", label: "Templates library", description: "Add ready-made courses, policies, checklists and corrective-action templates in one click.", defaultOn: true },
  // Discipline
  { key: "caseTemplates", group: "Discipline", label: "Corrective-action templates", description: "Pre-filled wording for common policy violations when logging a case.", defaultOn: true },
  { key: "evidence", group: "Discipline", label: "Witness statements and evidence", description: "Attach files and witness statements to cases.", defaultOn: true },
  { key: "appeals", group: "Discipline", label: "Appeals", description: "Employees can appeal a case, and someone other than the issuer reviews it.", defaultOn: true },
  { key: "progressive", group: "Discipline", label: "Progressive discipline rules", description: "Automatically escalate a case when a pattern repeats, such as a third verbal warning in 90 days.", defaultOn: false },
  { key: "safetyLog", group: "Discipline", label: "Safety incident details", description: "Severity, root cause and corrective actions on incident reports, plus a printable summary.", defaultOn: true },
  // Shifts and operations
  { key: "recurring", group: "Shifts and operations", label: "Recurring checklists and missed alerts", description: "Schedule checklists for set days and get told when one is missed.", defaultOn: true },
  { key: "checklistPhotos", group: "Shifts and operations", label: "Photo evidence on checklists", description: "Employees can attach photos when they submit a checklist.", defaultOn: true },
  { key: "handoff", group: "Shifts and operations", label: "Shift handoff notes", description: "A shared feed of notes between shifts.", defaultOn: true },
  { key: "scheduling", group: "Shifts and operations", label: "Shift scheduling and swaps", description: "Build a weekly schedule. Employees see their shifts and can request swaps.", defaultOn: false },
  { key: "timeClock", group: "Shifts and operations", label: "Time clock", description: "Employees clock in and out. Managers see timesheets and can export them.", defaultOn: false },
  { key: "assets", group: "Shifts and operations", label: "Equipment sign-out", description: "Track who has which tool, key or vehicle.", defaultOn: false },
  // Access
  { key: "customRoles", group: "Access", label: "Custom roles and permissions", description: "Create roles such as Safety lead and choose what each role can do.", defaultOn: true },
];

export type FeatureMap = Record<string, boolean>;

export function featureOn(features: unknown, key: string): boolean {
  const f = FEATURES.find((x) => x.key === key);
  if (!f) return false;
  const v = (features as FeatureMap | null)?.[key];
  return typeof v === "boolean" ? v : f.defaultOn;
}
