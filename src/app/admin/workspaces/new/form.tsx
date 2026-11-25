"use client";
import { useState } from "react";
import Link from "next/link";
import { createWorkspaceForCustomerAction, generateWorkspacePlanAction, type WorkspacePlan } from "@/actions/admin-workspaces";
import { Field, useAction } from "@/components/ui";

type Opt = { id: string; title: string };
type Done = { id: string; isNew: boolean; emailed: boolean; courses: number; policies: number; checklists: number };

function Picks({ label, opts, sel, set }: { label: string; opts: Opt[]; sel: string[]; set: (v: string[]) => void }) {
  return (
    <fieldset className="space-y-1">
      <legend className="label">{label}</legend>
      {opts.map((o) => (
        <label key={o.id} className="flex items-center gap-2 text-[13px]">
          <input type="checkbox" checked={sel.includes(o.id)} onChange={(e) => set(e.target.checked ? [...sel, o.id] : sel.filter((x) => x !== o.id))} />
          {o.title}
        </label>
      ))}
    </fieldset>
  );
}

export function NewWorkspaceForm({ courses, policies, checklists }: { courses: Opt[]; policies: Opt[]; checklists: Opt[] }) {
  const { exec, pending } = useAction();
  const [workspaceName, setWs] = useState("");
  const [ownerName, setName] = useState("");
  const [ownerEmail, setEmail] = useState("");
  const [c, setC] = useState<string[]>([]);
  const [p, setP] = useState<string[]>([]);
  const [k, setK] = useState<string[]>([]);
  const [sendInvite, setSend] = useState(true);
  const [aiText, setAiText] = useState("");
  const [plan, setPlan] = useState<WorkspacePlan | null>(null);
  const [done, setDone] = useState<Done | null>(null);

  if (done) {
    return (
      <div className="card max-w-xl space-y-2 p-5 text-[14px]">
        <div className="font-semibold">Workspace created.</div>
        <p>{done.isNew ? "A new owner account was made." : "The owner's existing account was attached."} {done.emailed ? "The email was sent." : "No email was sent (or it failed). Check the email log."}</p>
        <p className="text-soft">Added {done.courses} course(s), {done.policies} polic{done.policies === 1 ? "y" : "ies"}, {done.checklists} checklist(s) as drafts.</p>
        <div className="flex gap-2"><Link className="btn" href={`/admin/workspaces/${done.id}`}>Open workspace</Link><button className="btn" onClick={() => { setDone(null); setWs(""); setName(""); setEmail(""); setC([]); setP([]); setK([]); }}>Set up another</button></div>
      </div>
    );
  }
  return (
    <form
      className="card max-w-xl space-y-4 p-5"
      onSubmit={(e) => {
        e.preventDefault();
        exec(() => createWorkspaceForCustomerAction({ plan: plan ?? undefined, workspaceName, ownerName, ownerEmail, courses: c, policies: p, checklists: k, sendInvite }), { onOk: (d) => setDone(d as Done) });
      }}
    >
      <Field label="Business name"><input className="input" value={workspaceName} onChange={(e) => setWs(e.target.value)} maxLength={80} required /></Field>
      <Field label="Owner's name"><input className="input" value={ownerName} onChange={(e) => setName(e.target.value)} maxLength={80} required /></Field>
      <Field label="Owner's email"><input className="input" type="email" value={ownerEmail} onChange={(e) => setEmail(e.target.value)} required /></Field>
      <div className="space-y-2 rounded-md border border-line p-3">
        <Field label="Build it with AI (optional)"><textarea className="textarea" rows={3} maxLength={3000} value={aiText} onChange={(e) => setAiText(e.target.value)} placeholder="e.g. A 12-person family restaurant in Cumming, GA: servers, line cooks, a dishwasher. Needs food safety, opening and closing checklists." /></Field>
        <button type="button" className="btn" disabled={pending || aiText.trim().length < 10} onClick={() => exec(() => generateWorkspacePlanAction({ prompt: aiText }), { success: "Draft ready. Review it below.", onOk: (d) => setPlan(d as WorkspacePlan) })}>{pending ? "Working…" : plan ? "Regenerate" : "Generate setup"}</button>
        {plan && (
          <div className="text-[13px]">
            <p className="font-medium">AI draft (added when you create the workspace):</p>
            <ul className="ml-4 list-disc text-soft">
              <li>Departments: {plan.departments.map((x) => x.name).join(", ") || "none"}</li>
              <li>Job roles: {plan.jobRoles.map((x) => x.title).join(", ") || "none"}</li>
              <li>Courses: {plan.courses.map((x) => x.title).join("; ") || "none"}</li>
              <li>Policies: {plan.policies.map((x) => x.title).join("; ") || "none"}</li>
              <li>Checklists: {plan.checklists.map((x) => x.title).join("; ") || "none"}</li>
            </ul>
            <button type="button" className="btn mt-1" onClick={() => setPlan(null)}>Discard draft</button>
          </div>
        )}
      </div>
      <Picks label="First course(s)" opts={courses} sel={c} set={setC} />
      <Picks label="Policies (optional)" opts={policies} sel={p} set={setP} />
      <Picks label="Checklists (optional)" opts={checklists} sel={k} set={setK} />
      <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" checked={sendInvite} onChange={(e) => setSend(e.target.checked)} />Email the owner now</label>
      <button className="btn btn-primary" disabled={pending}>{pending ? "Creating…" : "Create workspace"}</button>
    </form>
  );
}
