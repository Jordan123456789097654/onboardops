"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Sparkles, X } from "lucide-react";
import { saveDepartmentAction, saveJobRoleAction } from "@/actions/settings";
import { createEmployeeAction } from "@/actions/employees";
import { installLibraryAction } from "@/actions/library";
import { finishSetupAction } from "@/actions/records";
import { runAiTaskAction } from "@/actions/ai";
import { Badge, PageHeader, useToast } from "@/components/ui";
import { cn } from "@/lib/utils";

type Item = { id: string; title: string };
type SetupPlan = {
  departments: string[];
  jobRoles: { title: string; description: string; courseIds: string[] }[];
  courseIds: string[];
  policyIds: string[];
  checklistIds: string[];
  customChecklistIdeas: string[];
  starterNotes: string;
};

const INDUSTRY_STARTERS: { label: string; description: string }[] = [
  {
    label: "Coffee Shop / Cafe",
    description: "Neighborhood coffee shop and bakery with 14 staff across opening, mid-day, and closing shifts. Front counter baristas handle espresso drinks, POS registers, cash drawers, and pastry service; kitchen staff handle food prep and sanitation.",
  },
  {
    label: "Retail Store",
    description: "Specialty retail store with 18 part-time and full-time associates. Floor team handles customer service, fitting rooms, and POS registers; stockroom team handles receiving deliveries, inventory counts, and loss prevention.",
  },
  {
    label: "Warehouse & Logistics",
    description: "Distribution warehouse with 30 shift workers across receiving, picking/packing, and shipping docks. Teams operate forklifts and pallet jacks, follow PPE and loading-dock safety rules, and complete daily equipment and dock checklists.",
  },
  {
    label: "Quick-Service Restaurant",
    description: "Fast-casual restaurant with 25 crew members across front counter, drive-thru, and line kitchen. High-volume meal rushes, food safety and temperature logs, grill and fryer closing procedures, and shift leads overseeing cash drops.",
  },
];

export function Wizard({ workspace, hasDepts, hasPeople, signIn, courses, policies, checklists, ai = false }: { workspace: string; hasDepts: boolean; hasPeople: boolean; signIn: string; courses: Item[]; policies: Item[]; checklists: Item[]; ai?: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [depts, setDepts] = useState("Warehouse\nFront Desk");
  const [people, setPeople] = useState("");
  const [pick, setPick] = useState<{ courses: string[]; policies: string[]; checklists: string[] }>({ courses: [], policies: [], checklists: [] });

  // AI Setup Assistant state
  const [aiOpen, setAiOpen] = useState(true);
  const [bizDesc, setBizDesc] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [plan, setPlan] = useState<SetupPlan | null>(null);
  const [selectedRoleIdxs, setSelectedRoleIdxs] = useState<number[]>([]);
  const [planApplied, setPlanApplied] = useState(false);
  const [rolesBusy, setRolesBusy] = useState(false);
  const [rolesCreated, setRolesCreated] = useState(false);

  const steps = ["Departments", "Your team", "Starter content", "Finish"];
  const flip = (k: keyof typeof pick, id: string) => setPick((p) => ({ ...p, [k]: p[k].includes(id) ? p[k].filter((x) => x !== id) : [...p[k], id] }));

  async function buildPlan() {
    if (bizDesc.trim().length < 15) {
      toast("error", "Describe your business, team size, and main shifts (at least 15 characters).");
      return;
    }
    setAiBusy(true);
    const r = await runAiTaskAction("setup.plan", {
      description: bizDesc.trim(),
      availableCourses: courses,
      availablePolicies: policies,
      availableChecklists: checklists,
    }) as { ok: true; data: SetupPlan } | { ok: false; error: string };
    setAiBusy(false);
    if (!r.ok) {
      toast("error", r.error);
      return;
    }
    const validCourses = new Set(courses.map((c) => c.id));
    const validPolicies = new Set(policies.map((p) => p.id));
    const validChecklists = new Set(checklists.map((c) => c.id));
    const cleanedRoles = r.data.jobRoles
      .map((jr) => ({
        title: jr.title.trim(),
        description: jr.description.trim(),
        courseIds: Array.from(new Set(jr.courseIds.filter((id) => validCourses.has(id)))),
      }))
      .filter((jr) => jr.title.length >= 2);
    const cleaned: SetupPlan = {
      departments: Array.from(new Set(r.data.departments.map((d) => d.trim()).filter(Boolean))),
      jobRoles: cleanedRoles,
      courseIds: Array.from(new Set(r.data.courseIds.filter((id) => validCourses.has(id)))),
      policyIds: Array.from(new Set(r.data.policyIds.filter((id) => validPolicies.has(id)))),
      checklistIds: Array.from(new Set(r.data.checklistIds.filter((id) => validChecklists.has(id)))),
      customChecklistIdeas: r.data.customChecklistIdeas.map((s) => s.trim()).filter(Boolean),
      starterNotes: r.data.starterNotes.trim(),
    };
    setPlan(cleaned);
    setSelectedRoleIdxs(cleaned.jobRoles.map((_, i) => i));
    setPlanApplied(false);
    setRolesCreated(false);
    toast("ok", "Starter plan ready — review before applying.");
  }

  function applyPlan() {
    if (!plan) return;
    if (plan.departments.length > 0) setDepts(plan.departments.join("\n"));
    setPick({
      courses: plan.courseIds,
      policies: plan.policyIds,
      checklists: plan.checklistIds,
    });
    setPlanApplied(true);
    toast("ok", "Applied to Departments (Step 1) and Starter content (Step 3). Review each step before saving.");
  }

  async function createSuggestedRoles() {
    if (!plan) return;
    const toCreate = plan.jobRoles.filter((_, i) => selectedRoleIdxs.includes(i));
    if (toCreate.length === 0) {
      toast("error", "Select at least one suggested job role to create.");
      return;
    }
    setRolesBusy(true);
    let ok = 0;
    let bad = 0;
    for (const jr of toCreate) {
      const r = await saveJobRoleAction({
        title: jr.title,
        description: jr.description,
        requiredCourseIds: jr.courseIds,
        pathSequential: false,
      });
      if (r.ok) ok++;
      else bad++;
    }
    setRolesBusy(false);
    if (ok > 0) {
      setRolesCreated(true);
      router.refresh();
    }
    toast(bad ? "error" : "ok", `${ok} job role${ok === 1 ? "" : "s"} created${bad ? `, ${bad} failed` : ""}`);
  }

  async function saveDepts() {
    setBusy(true);
    const names = depts.split("\n").map((s) => s.trim()).filter(Boolean);
    for (const name of names) await saveDepartmentAction({ name, colorCode: "#52525B" });
    setBusy(false); toast("ok", `${names.length} department(s) saved`); setStep(1);
  }
  async function savePeople() {
    setBusy(true);
    let n = 0, bad = 0;
    for (const line of people.split("\n").map((s) => s.trim()).filter(Boolean)) {
      const [name, email] = line.split(/[,\t]/).map((s) => s.trim());
      if (!name || !email) { bad++; continue; }
      const r = await createEmployeeAction({ fullName: name, email, sendInvite: false });
      if (r.ok) n++; else bad++;
    }
    setBusy(false); toast(bad ? "error" : "ok", `${n} added${bad ? `, ${bad} line(s) skipped (use: Name, email)` : ""}`); setStep(2);
  }
  async function install() {
    setBusy(true);
    const r = await installLibraryAction({ ...pick, cases: [] });
    setBusy(false);
    if (r.ok) toast("ok", `Added ${r.data.courses} course(s), ${r.data.policies} policy(ies), ${r.data.checklists} checklist(s)`); else toast("error", r.error);
    setStep(3);
  }
  async function finish() { await finishSetupAction(); router.push("/app/overview"); router.refresh(); }

  const list = (title: string, k: keyof typeof pick, items: Item[]) => (
    <div><div className="mb-1 text-xs font-semibold text-soft">{title}</div><div className="space-y-1">{items.map((i) => { const on = pick[k].includes(i.id); return <button key={i.id} onClick={() => flip(k, i.id)} className={cn("flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left text-[13px] transition-colors", on ? "border-accent bg-muted" : "border-line hover:bg-muted")}><span className={cn("flex h-4 w-4 items-center justify-center rounded border", on ? "border-accent bg-accent text-accent-fg" : "border-line")}>{on && <Check className="h-3 w-3" />}</span>{i.title}</button>; })}</div></div>
  );

  const titleById = (items: Item[], id: string) => items.find((i) => i.id === id)?.title;

  return (
    <>
      <PageHeader title={`Set up ${workspace}`} sub="Four quick steps. You can skip any of them and come back later." />
      {ai && (
        <div className="mb-6 max-w-2xl rounded-lg border border-accent/30 bg-accent/5 p-4 text-[13px]">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-accent" />
              <span className="font-semibold">AI Setup Assistant</span>
              {planApplied && <Badge value="ACTIVE" label="Applied" />}
            </div>
            <button type="button" className="text-xs text-accent underline" onClick={() => setAiOpen((v) => !v)}>
              {aiOpen ? "Hide" : "Show"}
            </button>
          </div>
          {aiOpen && (
            <div className="mt-3 space-y-3">
              <p className="text-xs text-soft">Pick an industry starter pack or describe your business to draft departments, job roles, and starter content. Nothing is saved until you review and click apply or create.</p>
              <div>
                <div className="mb-1.5 text-[11px] font-medium text-soft">Industry starter packs</div>
                <div className="flex flex-wrap gap-1.5">
                  {INDUSTRY_STARTERS.map((s) => (
                    <button
                      key={s.label}
                      type="button"
                      className="btn !h-7 !px-2.5 !text-xs"
                      onClick={() => setBizDesc(s.description)}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
              <textarea
                className="textarea"
                rows={3}
                value={bizDesc}
                onChange={(e) => setBizDesc(e.target.value)}
                placeholder="Describe your business type, team size, roles, and main shifts (e.g., 15-person cafe with opening baristas, kitchen prep, and closing shift leads)…"
              />
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="btn-primary"
                  disabled={aiBusy || bizDesc.trim().length < 15}
                  onClick={buildPlan}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  {aiBusy ? "Building starter plan…" : "Build starter plan with AI"}
                </button>
                {bizDesc.trim().length > 0 && bizDesc.trim().length < 15 && (
                  <span className="text-xs text-soft">Add a few more details to build a plan.</span>
                )}
              </div>

              {plan && (
                <div className="mt-3 space-y-3 rounded-lg border border-line bg-surface p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-xs font-semibold">Suggested starter plan</div>
                      {plan.starterNotes && <p className="mt-0.5 text-xs text-soft">{plan.starterNotes}</p>}
                    </div>
                    <button type="button" className="text-soft hover:text-ink" aria-label="Dismiss starter plan" onClick={() => { setPlan(null); setPlanApplied(false); setRolesCreated(false); }}>
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  {plan.departments.length > 0 && (
                    <div>
                      <div className="mb-1 text-[11px] font-semibold text-soft">Suggested departments ({plan.departments.length})</div>
                      <div className="flex flex-wrap gap-1.5">
                        {plan.departments.map((d) => (
                          <span key={d} className="rounded-md border border-line bg-muted px-2 py-0.5 text-xs">{d}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {plan.jobRoles.length > 0 && (
                    <div>
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span className="text-[11px] font-semibold text-soft">Suggested job roles ({plan.jobRoles.length})</span>
                        {rolesCreated && <Badge value="ACTIVE" label="Roles created" />}
                      </div>
                      <div className="space-y-1.5">
                        {plan.jobRoles.map((jr, idx) => {
                          const checked = selectedRoleIdxs.includes(idx);
                          const matchedTitles = jr.courseIds.map((id) => titleById(courses, id)).filter(Boolean);
                          return (
                            <label key={`${jr.title}-${idx}`} className="flex items-start gap-2 rounded-md border border-line px-2.5 py-2 text-xs">
                              <input
                                type="checkbox"
                                className="mt-0.5"
                                checked={checked}
                                disabled={rolesCreated || rolesBusy}
                                onChange={() => setSelectedRoleIdxs((prev) => prev.includes(idx) ? prev.filter((x) => x !== idx) : [...prev, idx])}
                              />
                              <div className="min-w-0 flex-1">
                                <div className="font-medium">{jr.title}</div>
                                {jr.description && <div className="text-soft">{jr.description}</div>}
                                {matchedTitles.length > 0 && (
                                  <div className="mt-0.5 text-[11px] text-soft">Suggested courses: {matchedTitles.join(" · ")}</div>
                                )}
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {(plan.courseIds.length > 0 || plan.policyIds.length > 0 || plan.checklistIds.length > 0) && (
                    <div className="space-y-1.5">
                      <div className="text-[11px] font-semibold text-soft">Starter content to pre-select in Step 3</div>
                      <div className="grid gap-2 text-xs sm:grid-cols-3">
                        <div className="rounded-md border border-line bg-muted/50 p-2">
                          <div className="font-medium">Courses ({plan.courseIds.length})</div>
                          <ul className="mt-1 space-y-0.5 text-soft">
                            {plan.courseIds.length > 0 ? plan.courseIds.map((id) => <li key={id}>• {titleById(courses, id)}</li>) : <li>None selected</li>}
                          </ul>
                        </div>
                        <div className="rounded-md border border-line bg-muted/50 p-2">
                          <div className="font-medium">Policies ({plan.policyIds.length})</div>
                          <ul className="mt-1 space-y-0.5 text-soft">
                            {plan.policyIds.length > 0 ? plan.policyIds.map((id) => <li key={id}>• {titleById(policies, id)}</li>) : <li>None selected</li>}
                          </ul>
                        </div>
                        <div className="rounded-md border border-line bg-muted/50 p-2">
                          <div className="font-medium">Checklists ({plan.checklistIds.length})</div>
                          <ul className="mt-1 space-y-0.5 text-soft">
                            {plan.checklistIds.length > 0 ? plan.checklistIds.map((id) => <li key={id}>• {titleById(checklists, id)}</li>) : <li>None selected</li>}
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}

                  {plan.customChecklistIdeas.length > 0 && (
                    <div>
                      <div className="mb-1 text-[11px] font-semibold text-soft">Custom checklist ideas for later</div>
                      <ul className="list-disc space-y-0.5 pl-4 text-xs text-soft">
                        {plan.customChecklistIdeas.map((idea, i) => <li key={i}>{idea}</li>)}
                      </ul>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
                    <button type="button" className="btn-primary" onClick={applyPlan}>
                      {planApplied ? "Re-apply plan to wizard" : "Apply plan to wizard"}
                    </button>
                    {plan.jobRoles.length > 0 && (
                      <button
                        type="button"
                        className="btn"
                        disabled={rolesBusy || rolesCreated || selectedRoleIdxs.length === 0}
                        onClick={createSuggestedRoles}
                      >
                        {rolesBusy ? "Creating job roles…" : rolesCreated ? "Job roles created" : `Create suggested job roles (${selectedRoleIdxs.length})`}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
      <ol className="mb-6 flex gap-2">{steps.map((s, i) => <li key={s} className="flex-1"><div className={cn("h-1 rounded", i <= step ? "bg-accent" : "bg-line")} /><div className={cn("mt-1 text-xs", i === step ? "font-semibold" : "text-soft")}>{i + 1}. {s}</div></li>)}</ol>
      <div className="card max-w-2xl p-5">
        {step === 0 && (<div className="space-y-3"><h2 className="font-semibold">Where do people work?</h2><p className="text-[13px] text-soft">One department per line. {hasDepts && "You already have some; duplicates are fine to skip."}</p><textarea className="textarea" rows={5} value={depts} onChange={(e) => setDepts(e.target.value)} /><div className="flex gap-2"><button className="btn-primary" disabled={busy} onClick={saveDepts}>{busy ? "Saving…" : "Save and continue"}</button><button className="btn" onClick={() => setStep(1)}>Skip</button></div></div>)}
        {step === 1 && (<div className="space-y-3"><h2 className="font-semibold">Add your team</h2><p className="text-[13px] text-soft">One person per line as <span className="mono">Name, email</span>. {hasPeople && "Have a spreadsheet? "}<Link className="text-accent underline" href="/app/directory">Import a CSV from the Staff Directory</Link> instead. Invites come later, from Staff Accounts.</p><textarea className="textarea mono" rows={6} value={people} onChange={(e) => setPeople(e.target.value)} placeholder={"Jordan Ellis, jordan@example.com\nMaria Santos, maria@example.com"} /><div className="flex gap-2"><button className="btn-primary" disabled={busy || !people.trim()} onClick={savePeople}>{busy ? "Adding…" : "Add people and continue"}</button><button className="btn" onClick={() => setStep(2)}>Skip</button></div></div>)}
        {step === 2 && (<div className="space-y-4"><h2 className="font-semibold">Start with ready-made content</h2><p className="text-[13px] text-soft">They arrive as drafts for you to review. More are in the Templates Library.</p>{list("Courses", "courses", courses)}{list("Policies", "policies", policies)}{list("Checklists", "checklists", checklists)}<div className="flex gap-2"><button className="btn-primary" disabled={busy} onClick={install}>{busy ? "Adding…" : "Add selected and continue"}</button><button className="btn" onClick={() => setStep(3)}>Skip</button></div></div>)}
        {step === 3 && (<div className="space-y-3"><h2 className="font-semibold">You&apos;re set</h2><ul className="list-disc space-y-1 pl-5 text-[13px] text-soft"><li>Publish a course in the <Link className="text-accent underline" href="/app/training">Training Academy</Link> and assign it.</li><li>Send sign-in invites from <Link className="text-accent underline" href="/app/access">Staff Accounts</Link>. Your staff sign-in page is <span className="mono text-ink">{signIn}</span>.</li><li>Turn features on or off in Settings, Features.</li><li>Watch the <a className="text-accent underline" href="https://onboardops.org/tutorial" target="_blank" rel="noopener noreferrer">two minute video tutorial</a> for the rest of the setup.</li></ul><button className="btn-primary" onClick={finish}>Go to the Command Center</button></div>)}
      </div>
    </>
  );
}
