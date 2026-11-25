"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp } from "lucide-react";
import { createTeamMemberAction, deleteTeamMemberAction, moveTeamMemberAction, saveTeamPageAction, setTeamMemberVisibleAction, updateTeamMemberAction } from "@/actions/team";
import { Badge, Empty, Field, Modal, useAction, useToast } from "@/components/ui";

type Item = { id: string; name: string; role: string; bio: string; linkUrl: string; visible: boolean; photoUrl: string | null };
type Form = { name: string; role: string; bio: string; linkUrl: string; visible: boolean };
const EMPTY: Form = { name: "", role: "", bio: "", linkUrl: "", visible: true };

/** Shrinks a chosen picture to a small square JPEG in the browser, so the photo stays light. */
async function toSmallJpeg(file: File): Promise<string> {
  const bmp = await createImageBitmap(file);
  const size = 256;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("Could not read that image.");
  const side = Math.min(bmp.width, bmp.height);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size, size);
  ctx.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, size, size);
  return c.toDataURL("image/jpeg", 0.85);
}

export function TeamAdmin({ items, canEdit, title, intro }: { items: Item[]; canEdit: boolean; title: string; intro: string }) {
  const router = useRouter();
  const toast = useToast();
  const { exec, pending } = useAction();
  const [dlg, setDlg] = useState<null | "new" | Item>(null);
  const [f, setF] = useState<Form>(EMPTY);
  /** undefined: keep the current photo, null: remove it, string: a new one. */
  const [photo, setPhoto] = useState<string | null | undefined>(undefined);
  const [preview, setPreview] = useState<string | null>(null);
  const [pageTitle, setPageTitle] = useState(title);
  const [pageIntro, setPageIntro] = useState(intro);
  const file = useRef<HTMLInputElement>(null);

  const open = (d: "new" | Item) => {
    if (d === "new") {
      setF(EMPTY);
      setPhoto(undefined);
      setPreview(null);
    } else {
      setF({ name: d.name, role: d.role, bio: d.bio, linkUrl: d.linkUrl, visible: d.visible });
      setPhoto(undefined);
      setPreview(d.photoUrl);
    }
    setDlg(d);
  };
  const choose = async (fl: File | undefined) => {
    if (!fl) return;
    try {
      const url = await toSmallJpeg(fl);
      setPhoto(url);
      setPreview(url);
    } catch (e) {
      toast("error", e instanceof Error ? e.message : "Could not read that image.");
    }
  };
  const save = () => {
    const payload = { ...f, ...(photo !== undefined ? { photo } : {}) };
    const after = { success: dlg === "new" ? "Person added" : "Saved", onOk: () => { setDlg(null); router.refresh(); } };
    if (dlg === "new") exec(() => createTeamMemberAction(payload), after);
    else if (dlg) exec(() => updateTeamMemberAction(dlg.id, payload), after);
  };
  const refresh = { onOk: () => router.refresh() };

  return (
    <div className="space-y-4">
      <section className="card space-y-3 p-4">
        <h2 className="text-sm font-semibold">Page heading and intro</h2>
        <Field label="Heading"><input className="input" value={pageTitle} onChange={(e) => setPageTitle(e.target.value)} maxLength={100} disabled={!canEdit} /></Field>
        <Field label="Intro (optional, shown under the heading)"><textarea className="textarea" rows={3} value={pageIntro} onChange={(e) => setPageIntro(e.target.value)} maxLength={800} disabled={!canEdit} /></Field>
        {canEdit && <button className="btn" disabled={pending || pageTitle.trim().length < 2} onClick={() => exec(() => saveTeamPageAction({ title: pageTitle, intro: pageIntro }), { success: "Saved", ...refresh })}>Save heading and intro</button>}
      </section>

      <div className="flex flex-wrap items-center gap-2">
        {canEdit && <button className="btn-primary" onClick={() => open("new")}>Add a person</button>}
        <a className="btn" href="/team" target="_blank" rel="noopener noreferrer">View the team page</a>
        {!canEdit && <span className="text-xs text-soft">Only the site owner can change the team page.</span>}
      </div>

      {items.length === 0 ? <Empty title="No one on the team page yet" hint="Until you add someone and make them visible, the page shows a short placeholder." /> : (
        <div className="card divide-y divide-line">
          {items.map((t, i) => (
            <div key={t.id} className="flex flex-wrap items-start gap-3 px-4 py-3 text-[13px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {t.photoUrl ? <img src={t.photoUrl} alt="" className="h-10 w-10 shrink-0 rounded-full border border-line object-cover" /> : <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-line bg-muted text-xs text-soft">{t.name.slice(0, 1).toUpperCase()}</div>}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2"><span className="font-medium">{t.name}</span><span className="text-soft">{t.role}</span><Badge value={t.visible ? "ACTIVE" : "HIDDEN"} label={t.visible ? "Visible" : "Hidden"} /></div>
                {t.bio ? <p className="mt-1 line-clamp-2 text-soft">{t.bio}</p> : <p className="mt-1 text-soft">No bio yet.</p>}
              </div>
              {canEdit && (
                <div className="flex flex-wrap gap-1.5">
                  <button className="btn !px-2" aria-label="Move up" disabled={pending || i === 0} onClick={() => exec(() => moveTeamMemberAction(t.id, "up"), refresh)}><ArrowUp className="h-3.5 w-3.5" /></button>
                  <button className="btn !px-2" aria-label="Move down" disabled={pending || i === items.length - 1} onClick={() => exec(() => moveTeamMemberAction(t.id, "down"), refresh)}><ArrowDown className="h-3.5 w-3.5" /></button>
                  <button className="btn" disabled={pending} onClick={() => exec(() => setTeamMemberVisibleAction(t.id, !t.visible), refresh)}>{t.visible ? "Hide" : "Show"}</button>
                  <button className="btn" onClick={() => open(t)}>Edit</button>
                  <button className="btn-danger" disabled={pending} onClick={() => { if (window.confirm(`Remove ${t.name} from the team page? This cannot be undone.`)) exec(() => deleteTeamMemberAction(t.id), refresh); }}>Delete</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal open={dlg !== null} onClose={() => setDlg(null)} title={dlg === "new" ? "Add a person" : "Edit person"}>
        <div className="space-y-3 text-[13px]">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name"><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} maxLength={80} /></Field>
            <Field label="Role or title"><input className="input" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })} maxLength={100} placeholder="Chief Operating Officer" /></Field>
          </div>
          <Field label="Bio (optional; leave a blank line between paragraphs)"><textarea className="textarea" rows={6} maxLength={1500} value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })} /></Field>
          <Field label="Profile link (optional, must start with https://)"><input className="input" value={f.linkUrl} onChange={(e) => setF({ ...f, linkUrl: e.target.value })} maxLength={300} placeholder="https://www.linkedin.com/in/..." /></Field>
          <div>
            <div className="mb-1.5 text-xs font-medium text-soft">Photo (optional)</div>
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {preview ? <img src={preview} alt="" className="h-12 w-12 rounded-full border border-line object-cover" /> : <div className="grid h-12 w-12 place-items-center rounded-full border border-dashed border-line text-[11px] text-soft">None</div>}
              <input ref={file} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => { void choose(e.target.files?.[0]); e.target.value = ""; }} />
              <button type="button" className="btn" onClick={() => file.current?.click()}>{preview ? "Change" : "Choose a file"}</button>
              {preview && <button type="button" className="btn" onClick={() => { setPhoto(null); setPreview(null); }}>Remove</button>}
            </div>
            <p className="mt-1 text-xs text-soft">It is cropped to a square and shrunk for you.</p>
          </div>
          <label className="flex items-center gap-2"><input type="checkbox" checked={f.visible} onChange={(e) => setF({ ...f, visible: e.target.checked })} />Show on the team page</label>
          <p className="text-xs text-soft">Only publish what the person has agreed to. It is public as soon as they are visible.</p>
          <button className="btn-primary w-full" disabled={pending || f.name.trim().length < 2} onClick={save}>{dlg === "new" ? "Add person" : "Save"}</button>
        </div>
      </Modal>
    </div>
  );
}
