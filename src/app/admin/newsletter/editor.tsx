"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, FilePlus2, Globe, Loader2, Mail, Trash2 } from "lucide-react";
import { deleteNewsletterPostAction, removeSubscriberAction, saveNewsletterPostAction, sendNewsletterAction, setNewsletterStatusAction } from "@/actions/newsletter";
import { MarkupArticle } from "@/components/markup-article";
import { Field, useToast } from "@/components/ui";
import { NEWS_CATEGORIES, NEWS_TEMPLATES } from "@/lib/newsletter-templates";
import { cn, fmtDate, fmtDateTime } from "@/lib/utils";

export type IssueRow = { id: string; slug: string; title: string; summary: string; category: string; body: string; status: string; publishedAt: string | null; sentAt: string | null; sentTo: number; sentFailed: number };
export type SubRow = { id: string; email: string; status: string; at: string };

type Form = { id: string | null; title: string; slug: string; summary: string; category: string; body: string };
const BLANK: Form = { id: null, title: "", slug: "", summary: "", category: "Update", body: "" };

export function NewsletterEditor({ issues, subscribers, counts, isOwner }: { issues: IssueRow[]; subscribers: SubRow[]; counts: { active: number; pending: number; unsubscribed: number }; isOwner: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState<Form>(BLANK);
  const [tab, setTab] = useState<"write" | "preview">("write");
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState("");
  const current = issues.find((i) => i.id === form.id) ?? null;
  const blanks = useMemo(() => Array.from(new Set(`${form.title}\n${form.summary}\n${form.body}`.match(/\{\{[^}]+\}\}/g) ?? [])), [form]);
  const valid = form.title.trim().length >= 3 && form.body.trim().length >= 20;

  function open(i: IssueRow) {
    setForm({ id: i.id, title: i.title, slug: i.slug, summary: i.summary, category: i.category, body: i.body });
    setTab("write");
    setConfirm("");
  }

  async function save(): Promise<string | null> {
    const r = await saveNewsletterPostAction({ id: form.id ?? undefined, title: form.title, slug: form.slug || undefined, summary: form.summary, category: form.category, body: form.body });
    if (!r.ok) { toast("error", r.error); return null; }
    setForm((f) => ({ ...f, id: r.data.id, slug: r.data.slug }));
    return r.data.id;
  }

  async function act(name: string, fn: () => Promise<void>) {
    setBusy(name);
    try { await fn(); } finally { setBusy(null); }
  }

  const doSave = () => act("save", async () => { if (await save()) { toast("ok", "Saved"); router.refresh(); } });
  const doPublish = () => act("publish", async () => {
    const id = await save();
    if (!id) return;
    const r = await setNewsletterStatusAction({ id, status: "PUBLISHED" });
    if (r.ok) { toast("ok", "Published on the website. No email was sent."); router.refresh(); } else toast("error", r.error);
  });
  const doUnpublish = () => act("unpublish", async () => {
    if (!form.id) return;
    const r = await setNewsletterStatusAction({ id: form.id, status: "DRAFT" });
    if (r.ok) { toast("ok", "Back to a draft. It's no longer on the website."); router.refresh(); } else toast("error", r.error);
  });
  const doDelete = () => act("delete", async () => {
    if (!form.id || !window.confirm("Delete this issue permanently?")) return;
    const r = await deleteNewsletterPostAction(form.id);
    if (r.ok) { setForm(BLANK); router.refresh(); } else toast("error", r.error);
  });
  const doSend = (test: boolean) => act(test ? "test" : "send", async () => {
    const id = form.id;
    if (!id) return;
    if (!test && !window.confirm(`Email "${form.title}" to ${counts.active} confirmed subscriber${counts.active === 1 ? "" : "s"}? It can't be recalled.`)) return;
    const r = await sendNewsletterAction({ id, test, confirm: test ? undefined : confirm });
    if (r.ok) {
      toast(r.data.failed ? "error" : "ok", r.data.test ? "Test sent to your email." : `${r.data.delivered} sent${r.data.failed ? `, ${r.data.failed} failed` : ""}.`);
      if (!test) { setConfirm(""); router.refresh(); }
    } else toast("error", r.error);
  });

  return (
    <div className="grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
      <aside className="space-y-4">
        <div className="card p-3">
          <button type="button" className="btn-primary mb-2 w-full justify-center" onClick={() => { setForm(BLANK); setTab("write"); }}><FilePlus2 className="h-3.5 w-3.5" />New issue</button>
          <select className="input" value="" onChange={(e) => { const t = NEWS_TEMPLATES.find((x) => x.id === e.target.value); if (t) { setForm({ id: null, title: t.issueTitle, slug: "", summary: t.summary, category: t.category, body: t.body }); setTab("write"); } }} aria-label="Start from a template">
            <option value="">Start from a template…</option>
            {NEWS_TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
          </select>
        </div>

        <div className="card divide-y divide-line">
          {issues.length === 0 && <p className="p-4 text-[13px] text-soft">No issues yet. Pick a template to start.</p>}
          {issues.map((i) => (
            <button key={i.id} type="button" onClick={() => open(i)} className={cn("block w-full px-3 py-2.5 text-left hover:bg-muted", form.id === i.id && "bg-accent/5")}>
              <div className="truncate text-[13px] font-medium">{i.title}</div>
              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-soft">
                <span className={cn("badge !px-1.5 !py-0", i.status === "PUBLISHED" ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300" : "border-line bg-muted")}>{i.status === "PUBLISHED" ? "On website" : "Draft"}</span>
                {i.sentAt && <span className="badge !px-1.5 !py-0 border-line bg-muted">Emailed {i.sentTo}</span>}
                <span>{i.category}</span>
              </div>
            </button>
          ))}
        </div>

        <div className="card p-3 text-[12.5px]">
          <h2 className="mb-2 text-sm font-semibold">Subscribers</h2>
          <div className="grid grid-cols-3 gap-2 text-center">
            {[["Confirmed", counts.active], ["Waiting", counts.pending], ["Left", counts.unsubscribed]].map(([k, v]) => <div key={k as string} className="rounded-lg border border-line px-2 py-1.5"><div className="text-lg font-semibold tabular-nums">{v}</div><div className="text-[11px] text-soft">{k}</div></div>)}
          </div>
          <p className="mt-2 text-[11.5px] text-soft">&ldquo;Waiting&rdquo; people haven&apos;t confirmed yet, so they are never emailed.</p>
          {subscribers.length > 0 && (
            <ul className="mt-2 max-h-44 divide-y divide-line overflow-y-auto">
              {subscribers.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-2 py-1.5">
                  <span className="min-w-0"><span className="block truncate">{s.email}</span><span className="text-[11px] text-soft">{s.status.toLowerCase()} · {fmtDate(s.at)}</span></span>
                  {isOwner && <button type="button" aria-label={`Remove ${s.email}`} className="text-soft hover:text-rose-600" onClick={async () => { if (window.confirm(`Remove ${s.email} from the list?`)) { const r = await removeSubscriberAction(s.id); if (r.ok) router.refresh(); else toast("error", r.error); } }}><Trash2 className="h-3.5 w-3.5" /></button>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>

      <section className="card p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex rounded-lg border border-line bg-surface p-0.5">
            {(["write", "preview"] as const).map((t) => <button key={t} type="button" onClick={() => setTab(t)} className={cn("rounded-md px-3 py-1 text-[12.5px] font-medium", tab === t ? "bg-accent text-accent-fg" : "text-soft hover:text-ink")}>{t === "write" ? "Write" : "Preview"}</button>)}
          </div>
          {current && <span className="text-[12px] text-soft">{current.status === "PUBLISHED" ? <a className="inline-flex items-center gap-1 text-accent underline" href={`/newsletter/${current.slug}`} target="_blank" rel="noopener noreferrer">View on website<ExternalLink className="h-3 w-3" /></a> : "Draft, not on the website"}</span>}
        </div>

        {tab === "write" ? (
          <div className="space-y-3">
            <Field label="Title"><input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={140} placeholder="What's new in OnboardOps" /></Field>
            <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
              <Field label="One-line summary (shown in the list and in link previews)"><input className="input" value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} maxLength={300} /></Field>
              <Field label="Category"><select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{NEWS_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
            </div>
            <Field label="Web address (optional, made from the title if empty)"><div className="flex items-center gap-1.5"><span className="mono text-[12px] text-soft">/newsletter/</span><input className="input" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, "-") })} maxLength={80} placeholder="auto" /></div></Field>
            <Field label="Body">
              <textarea className="textarea mono !text-[13px]" rows={20} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder={"Write the issue here.\n\n## A heading\n- A bullet\n>+ Good news box"} />
            </Field>
            <details className="text-[12px] text-soft">
              <summary className="cursor-pointer">Formatting help</summary>
              <pre className="mt-2 overflow-x-auto rounded-lg border border-line bg-muted p-3 text-[12px] leading-relaxed">{`## Heading        - bullet        1. numbered step
**bold**    [link text](https://example.com)    [page](/pricing)
> blue note     >! warning     >!! alert     >+ good news
[details]
Label: value`}</pre>
            </details>
            {blanks.length > 0 && <p className="rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">Fill in before publishing: {blanks.slice(0, 6).join(", ")}</p>}
          </div>
        ) : (
          <div>
            {!valid ? <p className="py-10 text-center text-[13px] text-soft">Write a title and some text to see the issue.</p> : (
              <article className="rounded-lg border border-line bg-surface p-6">
                <div className="text-[12px] text-soft">{form.category}</div>
                <h1 className="mt-1 text-2xl font-semibold">{form.title}</h1>
                {form.summary && <p className="mt-2 text-base text-soft">{form.summary}</p>}
                <div className="mt-5 border-t border-line pt-5"><MarkupArticle body={form.body} /></div>
              </article>
            )}
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
          <button type="button" className="btn" disabled={!valid || !!busy} onClick={() => void doSave()}>{busy === "save" ? "Saving…" : "Save draft"}</button>
          <button type="button" className="btn-primary" disabled={!valid || !!busy || blanks.length > 0} onClick={() => void doPublish()}>{busy === "publish" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Globe className="h-3.5 w-3.5" />}{current?.status === "PUBLISHED" ? "Save and update website" : "Publish to website"}</button>
          {current?.status === "PUBLISHED" && <button type="button" className="btn" disabled={!!busy} onClick={() => void doUnpublish()}>Unpublish</button>}
          {isOwner && form.id && <button type="button" className="btn ml-auto text-rose-600" disabled={!!busy} onClick={() => void doDelete()}><Trash2 className="h-3.5 w-3.5" />Delete</button>}
        </div>

        <details className="mt-4 rounded-xl border border-line bg-muted/40 p-4" open={!!current?.sentAt}>
          <summary className="flex cursor-pointer items-center gap-2 text-[13px] font-semibold"><Mail className="h-4 w-4" />Email this issue (optional)</summary>
          <div className="mt-3 space-y-3 text-[13px]">
            <p className="text-soft">Most issues are website-only, so skip this unless the issue is big enough to land in people&apos;s inboxes. The email is a short version with a button that links back to the website.</p>
            {current?.sentAt && <p className="rounded-lg border border-line bg-surface p-2.5 text-[12.5px]">Already emailed on {fmtDateTime(current.sentAt)}: {current.sentTo} delivered{current.sentFailed ? `, ${current.sentFailed} failed` : ""}. Sending again only reaches people who haven&apos;t received it yet.</p>}
            {!form.id || current?.status !== "PUBLISHED" ? <p className="text-soft">Save and publish the issue to the website first. Then you can send a test and email it.</p> : (
              <div className="space-y-3">
                <button type="button" className="btn" disabled={!!busy} onClick={() => void doSend(true)}>{busy === "test" ? "Sending…" : "Send a test to me"}</button>
                {isOwner ? (
                  <div className="flex flex-wrap items-end gap-2">
                    <Field label={`Type SEND to email ${counts.active} confirmed subscriber${counts.active === 1 ? "" : "s"}`}><input className="input !w-36" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="SEND" /></Field>
                    <button type="button" className="btn-primary" disabled={!!busy || confirm !== "SEND" || counts.active === 0} onClick={() => void doSend(false)}>{busy === "send" ? "Sending…" : "Email subscribers"}</button>
                  </div>
                ) : <p className="text-soft">Only an owner can email subscribers.</p>}
              </div>
            )}
          </div>
        </details>
      </section>
    </div>
  );
}
