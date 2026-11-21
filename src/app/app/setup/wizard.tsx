"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { saveDepartmentAction } from "@/actions/settings";
import { createEmployeeAction } from "@/actions/employees";
import { installLibraryAction } from "@/actions/library";
import { finishSetupAction } from "@/actions/records";
import { PageHeader, useToast } from "@/components/ui";
import { cn } from "@/lib/utils";

type Item = { id: string; title: string };

export function Wizard({ workspace, hasDepts, hasPeople, signIn, courses, policies, checklists }: { workspace: string; hasDepts: boolean; hasPeople: boolean; signIn: string; courses: Item[]; policies: Item[]; checklists: Item[] }) {
  const router = useRouter();
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [depts, setDepts] = useState("Warehouse\nFront Desk");
  const [people, setPeople] = useState("");
  const [pick, setPick] = useState<{ courses: string[]; policies: string[]; checklists: string[] }>({ courses: [], policies: [], checklists: [] });
  const steps = ["Departments", "Your team", "Starter content", "Finish"];
  const flip = (k: keyof typeof pick, id: string) => setPick((p) => ({ ...p, [k]: p[k].includes(id) ? p[k].filter((x) => x !== id) : [...p[k], id] }));

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

  return (
    <>
      <PageHeader title={`Set up ${workspace}`} sub="Four quick steps. You can skip any of them and come back later." />
      <ol className="mb-6 flex gap-2">{steps.map((s, i) => <li key={s} className="flex-1"><div className={cn("h-1 rounded", i <= step ? "bg-accent" : "bg-line")} /><div className={cn("mt-1 text-xs", i === step ? "font-semibold" : "text-soft")}>{i + 1}. {s}</div></li>)}</ol>
      <div className="card max-w-2xl p-5">
        {step === 0 && (<div className="space-y-3"><h2 className="font-semibold">Where do people work?</h2><p className="text-[13px] text-soft">One department per line. {hasDepts && "You already have some; duplicates are fine to skip."}</p><textarea className="textarea" rows={5} value={depts} onChange={(e) => setDepts(e.target.value)} /><div className="flex gap-2"><button className="btn-primary" disabled={busy} onClick={saveDepts}>{busy ? "Saving…" : "Save and continue"}</button><button className="btn" onClick={() => setStep(1)}>Skip</button></div></div>)}
        {step === 1 && (<div className="space-y-3"><h2 className="font-semibold">Add your team</h2><p className="text-[13px] text-soft">One person per line as <span className="mono">Name, email</span>. {hasPeople && "Have a spreadsheet? "}<Link className="text-accent underline" href="/app/directory">Import a CSV from the Staff Directory</Link> instead. Invites come later, from Staff Accounts.</p><textarea className="textarea mono" rows={6} value={people} onChange={(e) => setPeople(e.target.value)} placeholder={"Jordan Ellis, jordan@example.com\nMaria Santos, maria@example.com"} /><div className="flex gap-2"><button className="btn-primary" disabled={busy || !people.trim()} onClick={savePeople}>{busy ? "Adding…" : "Add people and continue"}</button><button className="btn" onClick={() => setStep(2)}>Skip</button></div></div>)}
        {step === 2 && (<div className="space-y-4"><h2 className="font-semibold">Start with ready-made content</h2><p className="text-[13px] text-soft">They arrive as drafts for you to review. More are in the Templates Library.</p>{list("Courses", "courses", courses)}{list("Policies", "policies", policies)}{list("Checklists", "checklists", checklists)}<div className="flex gap-2"><button className="btn-primary" disabled={busy} onClick={install}>{busy ? "Adding…" : "Add selected and continue"}</button><button className="btn" onClick={() => setStep(3)}>Skip</button></div></div>)}
        {step === 3 && (<div className="space-y-3"><h2 className="font-semibold">You&apos;re set</h2><ul className="list-disc space-y-1 pl-5 text-[13px] text-soft"><li>Publish a course in the <Link className="text-accent underline" href="/app/training">Training Academy</Link> and assign it.</li><li>Send sign-in invites from <Link className="text-accent underline" href="/app/access">Staff Accounts</Link>. Your staff sign-in page is <span className="mono text-ink">{signIn}</span>.</li><li>Turn features on or off in Settings, Features.</li></ul><button className="btn-primary" onClick={finish}>Go to the Command Center</button></div>)}
      </div>
    </>
  );
}
