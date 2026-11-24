"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Paperclip, Sparkles } from "lucide-react";
import { savePolicyAction } from "@/actions/policies";
import { runAiTaskAction } from "@/actions/ai";
import { Badge, Empty, Field, Modal, PageHeader, useAction, useToast } from "@/components/ui";
import { Bar } from "@/components/motion";
import { ACCEPT_ATTR } from "@/lib/files-client";

type Row = { externalUrl: string; id: string; title: string; description: string; contentMarkdown: string; fileId: string | null; fileName: string | null; version: number; appliesToAll: boolean; requiredJobRoleIds: string[]; isPublished: boolean; total: number; signed: number; unsigned: string[] };
type Draft = { externalUrl: string; id?: string; title: string; description: string; contentMarkdown: string; appliesToAll: boolean; requiredJobRoleIds: string[]; publish: boolean; newVersion: boolean; fileName?: string | null };

const blank = (): Draft => ({ title: "", description: "", contentMarkdown: "", appliesToAll: true, requiredJobRoleIds: [], publish: true, newVersion: false, externalUrl: "" });

const POLICY_STARTERS: { label: string; topic: string; bullets: string }[] = [
  {
    label: "Attendance & Tardiness",
    topic: "Attendance & Punctuality",
    bullets: "- Arrive ready to work at shift start; 5-minute grace period\n- Call or message the shift manager at least 2 hours before shift if sick or running late\n- No-call/no-show is treated as a serious infraction\n- Repeated unexcused absences follow progressive discipline",
  },
  {
    label: "Cash Handling",
    topic: "Cash Handling & Register Accountability",
    bullets: "- Count register drawer with a supervisor at start and end of shift\n- Never share register logins or leave cash unattended\n- Variances over $5 must be reported immediately\n- Safe drops required when drawer exceeds $300",
  },
  {
    label: "Workplace Safety",
    topic: "Workplace Safety & Incident Reporting",
    bullets: "- Wear required PPE and slip-resistant footwear at all times\n- Keep walkways and emergency exits completely clear\n- Report any hazard, near miss, or injury immediately in My Portal—good-faith safety reports are never punished\n- Do not operate equipment you have not been certified on",
  },
  {
    label: "Cell Phones & Social Media",
    topic: "Cell Phone Use & Social Media Conduct",
    bullets: "- Keep personal phones silent and stored away during active floor shifts; breaks only\n- Emergency family calls may be routed through the manager desk\n- Never post photos of customers, confidential records, or back-of-house areas on social media",
  },
  {
    label: "Dress Code & Uniforms",
    topic: "Dress Code, Uniforms & Hygiene",
    bullets: "- Clean company shirt/apron, closed-toe non-slip shoes, name badge visible\n- Tie back long hair in food/production areas; follow handwashing standards\n- Ask a manager for replacement gear if uniforms are damaged",
  },
  {
    label: "Opening & Closing Security",
    topic: "Opening, Closing & Facility Security",
    bullets: "- Never leave back doors propped open\n- Verify all exterior doors, windows, safes, and alarms before exiting\n- Close in pairs when possible and walk out together after dark\n- Lost keys or access badges must be reported immediately",
  },
];

export function Policies({ rows, roles, canEdit, ai = false }: { rows: Row[]; roles: { id: string; title: string }[]; canEdit: boolean; ai?: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const { exec, pending } = useAction();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  // AI Policy Drafter state
  const [aiOpen, setAiOpen] = useState(false);
  const [aiTopic, setAiTopic] = useState("");
  const [aiBiz, setAiBiz] = useState("");
  const [aiTone, setAiTone] = useState<"friendly" | "standard" | "formal">("standard");
  const [aiBullets, setAiBullets] = useState("");
  const [aiDrafted, setAiDrafted] = useState(false);

  const close = () => { setDraft(null); setFile(null); setAiOpen(false); setAiDrafted(false); };
  const openNew = (withAi = false) => {
    setDraft(blank());
    setAiOpen(withAi);
    setAiDrafted(false);
  };

  const generatePolicy = () => {
    if (!draft) return;
    exec(
      () => runAiTaskAction("policy.draft", { topic: aiTopic, bullets: aiBullets, businessType: aiBiz || undefined, tone: aiTone }) as Promise<{ ok: true; data: { title: string; description: string; contentMarkdown: string } } | { ok: false; error: string }>,
      {
        onOk: (res) => {
          setDraft({
            ...draft,
            title: res.title,
            description: res.description,
            contentMarkdown: res.contentMarkdown,
            publish: draft.id ? draft.publish : false,
          });
          setAiOpen(false);
          setAiDrafted(true);
          toast("ok", "Policy draft generated — review before publishing.");
        },
      }
    );
  };

  const save = () => {
    if (!draft) return;
    const fd = new FormData();
    const { fileName, ...json } = draft;
    fd.set("json", JSON.stringify(json));
    if (file) fd.set("file", file);
    exec(() => savePolicyAction(fd), { success: draft.publish ? "Policy saved. Employees in scope were notified if this needs a new signature." : "Draft saved", onOk: () => { close(); router.refresh(); } });
  };

  return (
    <>
      <PageHeader title="Policies" sub="Publish a policy or handbook, assign it to job roles, and track who has signed the current version.">
        {canEdit && ai && (
          <button className="btn" onClick={() => openNew(true)}>
            <Sparkles className="h-3.5 w-3.5 text-accent" />Draft with AI
          </button>
        )}
        {canEdit && <button className="btn-primary" onClick={() => openNew(false)}>New policy</button>}
      </PageHeader>
      {rows.length === 0 ? <Empty title="No policies yet" hint="Upload a PDF, write a policy, or click Draft with AI to generate a policy from bullet points." /> : (
        <div className="space-y-3">
          {rows.map((p) => {
            const pct = p.total ? Math.round((p.signed / p.total) * 100) : 0;
            return (
              <div key={p.id} className="card lift p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <FileText className="h-4 w-4 text-soft" /><h2 className="font-medium">{p.title}</h2><span className="mono text-xs text-soft">v{p.version}</span>
                  {p.isPublished ? <Badge value="ACTIVE" label="Published" /> : <Badge value="LOA" label="Draft" />}
                  <span className="ml-auto flex gap-2">
                    <a className="btn" href={`/print/policy/${p.id}`} target="_blank" rel="noreferrer">Sign-off sheet</a>
                    {p.externalUrl && <a className="btn" href={p.externalUrl} target="_blank" rel="noreferrer"><Paperclip className="h-3.5 w-3.5" />Linked file</a>}
                    {p.fileId && <a className="btn" href={`/api/files/${p.fileId}`} target="_blank" rel="noreferrer"><Paperclip className="h-3.5 w-3.5" />PDF</a>}
                    <button className="btn" onClick={() => setOpen(open === p.id ? null : p.id)}>{p.unsigned.length} unsigned</button>
                    {canEdit && <button className="btn" onClick={() => { setDraft({ id: p.id, title: p.title, description: p.description, contentMarkdown: p.contentMarkdown, appliesToAll: p.appliesToAll, requiredJobRoleIds: p.requiredJobRoleIds, publish: p.isPublished, newVersion: false, fileName: p.fileName, externalUrl: p.externalUrl }); setAiOpen(false); setAiDrafted(false); }}>Edit</button>}
                  </span>
                </div>
                {p.description && <p className="mt-1 text-[13px] text-soft">{p.description}</p>}
                <div className="mt-3 flex items-center gap-3"><Bar pct={pct} className="flex-1" /><span className="mono text-xs text-soft">{p.signed}/{p.total} signed</span></div>
                {open === p.id && <div className="anim-slide-down mt-3 rounded-md border border-line bg-muted p-3 text-[13px]">{p.unsigned.length === 0 ? "Everyone in scope has signed this version." : <><div className="mb-1 text-xs font-medium text-soft">Has not signed v{p.version}</div><ul className="columns-2 gap-4">{p.unsigned.map((u) => <li key={u} className="mono text-xs">{u}</li>)}</ul></>}</div>}
              </div>
            );
          })}
        </div>
      )}
      <Modal open={!!draft} onClose={close} title={draft?.id ? "Edit policy" : "New policy"}>
        {draft && (
          <div className="space-y-3">
            {ai && (
              <div className="rounded-lg border border-accent/30 bg-accent/5 p-3 text-[13px]">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold">
                    <Sparkles className="h-3.5 w-3.5 text-accent" />AI Policy &amp; Handbook Drafter
                  </span>
                  <button type="button" className="text-xs text-accent underline" onClick={() => setAiOpen((v) => !v)}>
                    {aiOpen ? "Hide" : "Draft from bullets"}
                  </button>
                </div>
                {aiOpen && (
                  <div className="mt-3 space-y-2.5">
                    <div>
                      <div className="mb-1 text-[11px] font-medium text-soft">Quick topic starters</div>
                      <div className="flex flex-wrap gap-1">
                        {POLICY_STARTERS.map((s) => (
                          <button
                            key={s.label}
                            type="button"
                            className="btn !h-6 !px-2 !text-[11px]"
                            onClick={() => { setAiTopic(s.topic); setAiBullets(s.bullets); }}
                          >
                            {s.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Field label="Policy topic">
                        <input className="input" value={aiTopic} onChange={(e) => setAiTopic(e.target.value)} placeholder="e.g. Attendance & Tardiness" />
                      </Field>
                      <Field label="Business type (optional)">
                        <input className="input" value={aiBiz} onChange={(e) => setAiBiz(e.target.value)} placeholder="e.g. coffee shop, warehouse" />
                      </Field>
                    </div>
                    <Field label="Tone">
                      <select className="input" value={aiTone} onChange={(e) => setAiTone(e.target.value as typeof aiTone)}>
                        <option value="friendly">Friendly &amp; approachable</option>
                        <option value="standard">Clear standard workplace English</option>
                        <option value="formal">Formal employee handbook</option>
                      </select>
                    </Field>
                    <Field label="Rules & bullet points to include">
                      <textarea
                        className="textarea"
                        rows={4}
                        value={aiBullets}
                        onChange={(e) => setAiBullets(e.target.value)}
                        placeholder="- Call out at least 2 hours before shift&#10;- Keep phones stored during floor shifts&#10;- Report safety hazards right away"
                      />
                    </Field>
                    <button
                      type="button"
                      className="btn-primary w-full"
                      disabled={pending || aiTopic.trim().length < 2 || aiBullets.trim().length < 15}
                      onClick={generatePolicy}
                    >
                      <Sparkles className="h-3.5 w-3.5" />{pending ? "Drafting policy…" : "Generate policy draft"}
                    </button>
                    <p className="text-[11px] text-soft">Creates an editable draft only—nothing is saved or published until you review it. Not legal advice.</p>
                  </div>
                )}
              </div>
            )}

            {aiDrafted && (
              <div className="rounded-md border border-amber-400/50 bg-amber-500/10 px-3 py-2 text-xs text-amber-950 dark:text-amber-200">
                AI draft loaded below (saved as Draft by default). Review every rule and replace any <span className="mono">[bracketed]</span> placeholders before ticking Published for staff signatures.
              </div>
            )}

            <Field label="Title"><input className="input" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></Field>
            <Field label="Short description"><input className="input" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></Field>
            <Field label="Policy text (Markdown, optional if you upload a PDF)"><textarea className="textarea" rows={8} value={draft.contentMarkdown} onChange={(e) => setDraft({ ...draft, contentMarkdown: e.target.value })} /></Field>
            <Field label="Or link a file from Google Drive, SharePoint, Dropbox or Box (optional)"><input className="input mono" placeholder="https://drive.google.com/…" value={draft.externalUrl} onChange={(e) => setDraft({ ...draft, externalUrl: e.target.value })} /></Field>
            <Field label={`PDF or document (max 4 MB)${draft.fileName ? `. Current: ${draft.fileName}` : ""}`}><input type="file" accept={ACCEPT_ATTR} className="text-xs" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></Field>
            <div>
              <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" checked={draft.appliesToAll} onChange={(e) => setDraft({ ...draft, appliesToAll: e.target.checked })} />Everyone must sign</label>
              {!draft.appliesToAll && <div className="mt-2 space-y-1 rounded-md border border-line p-2">{roles.map((r) => <label key={r.id} className="flex items-center gap-2 text-[13px]"><input type="checkbox" checked={draft.requiredJobRoleIds.includes(r.id)} onChange={() => setDraft({ ...draft, requiredJobRoleIds: draft.requiredJobRoleIds.includes(r.id) ? draft.requiredJobRoleIds.filter((x) => x !== r.id) : [...draft.requiredJobRoleIds, r.id] })} />{r.title}</label>)}</div>}
            </div>
            <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" checked={draft.publish} onChange={(e) => setDraft({ ...draft, publish: e.target.checked })} />Published (visible to employees)</label>
            {draft.id && (() => {
              const orig = rows.find((r) => r.id === draft.id)?.contentMarkdown ?? "";
              const lines = (t: string) => t.split(String.fromCharCode(10));
              const oldL = lines(orig), newL = lines(draft.contentMarkdown);
              const removed = oldL.filter((l) => l.trim() && !newL.includes(l)), added = newL.filter((l) => l.trim() && !oldL.includes(l));
              if (!removed.length && !added.length) return null;
              return (
                <div className="rounded-md border border-line bg-muted p-2 text-xs">
                  <div className="mb-1 font-medium">Changes from the saved version ({removed.length} removed, {added.length} added)</div>
                  <div className="max-h-40 space-y-0.5 overflow-y-auto mono">{removed.map((l, i) => <div key={`r${i}`} className="text-rose-700 dark:text-rose-300">- {l}</div>)}{added.map((l, i) => <div key={`a${i}`} className="text-emerald-700 dark:text-emerald-300">+ {l}</div>)}</div>
                  {!draft.newVersion && <p className="mt-1 text-soft">The text changed. Tick &quot;new version&quot; below if employees must sign again.</p>}
                </div>
              );
            })()}
            {draft.id && <label className="flex items-start gap-2 text-[13px]"><input type="checkbox" className="mt-0.5" checked={draft.newVersion} onChange={(e) => setDraft({ ...draft, newVersion: e.target.checked })} />This is a new version. Everyone in scope must sign again and is notified.</label>}
            <button className="btn-primary w-full" disabled={pending} onClick={save}>{pending ? "Saving…" : "Save policy"}</button>
          </div>
        )}
      </Modal>
    </>
  );
}
