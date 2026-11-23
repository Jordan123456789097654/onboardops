"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Star } from "lucide-react";
import { createTestimonialAction, deleteTestimonialAction, moveTestimonialAction, setTestimonialVisibleAction, updateTestimonialAction } from "@/actions/testimonials";
import { Badge, Empty, Field, Modal, useAction, useToast } from "@/components/ui";

type Item = { id: string; quote: string; name: string; jobTitle: string; company: string; rating: number | null; visible: boolean; photoUrl: string | null };
type Form = { quote: string; name: string; jobTitle: string; company: string; rating: number | null; visible: boolean };
const EMPTY: Form = { quote: "", name: "", jobTitle: "", company: "", rating: 5, visible: true };

/** Shrinks a chosen picture to a small square JPEG in the browser, so the photo stays light. */
async function toSmallJpeg(file: File): Promise<string> {
  const bmp = await createImageBitmap(file);
  const size = 192;
  const c = document.createElement("canvas");
  c.width = size; c.height = size;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("Could not read that image.");
  const side = Math.min(bmp.width, bmp.height);
  ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, size, size);
  ctx.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, size, size);
  return c.toDataURL("image/jpeg", 0.85);
}

export function TestimonialsAdmin({ items, canEdit }: { items: Item[]; canEdit: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const { exec, pending } = useAction();
  const [dlg, setDlg] = useState<null | "new" | Item>(null);
  const [f, setF] = useState<Form>(EMPTY);
  /** undefined: keep the current photo, null: remove it, string: a new one. */
  const [photo, setPhoto] = useState<string | null | undefined>(undefined);
  const [preview, setPreview] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);

  const open = (d: "new" | Item) => {
    if (d === "new") { setF(EMPTY); setPhoto(undefined); setPreview(null); }
    else { setF({ quote: d.quote, name: d.name, jobTitle: d.jobTitle, company: d.company, rating: d.rating, visible: d.visible }); setPhoto(undefined); setPreview(d.photoUrl); }
    setDlg(d);
  };
  const choose = async (fl: File | undefined) => {
    if (!fl) return;
    try { const url = await toSmallJpeg(fl); setPhoto(url); setPreview(url); } catch (e) { toast("error", e instanceof Error ? e.message : "Could not read that image."); }
  };
  const save = () => {
    const payload = { ...f, ...(photo !== undefined ? { photo } : {}) };
    const after = { success: dlg === "new" ? "Testimonial added" : "Saved", onOk: () => { setDlg(null); router.refresh(); } };
    if (dlg === "new") exec(() => createTestimonialAction(payload), after);
    else if (dlg) exec(() => updateTestimonialAction(dlg.id, payload), after);
  };
  const refresh = { onOk: () => router.refresh() };
  const stars = (n: number | null) => n ? <span className="inline-flex" aria-label={`${n} of 5`}>{[1, 2, 3, 4, 5].map((i) => <Star key={i} className={`h-3 w-3 ${i <= n ? "fill-current" : "opacity-25"}`} />)}</span> : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {canEdit && <button className="btn-primary" onClick={() => open("new")}>Add a testimonial</button>}
        <a className="btn" href="/" target="_blank" rel="noopener noreferrer">View homepage</a>
        {!canEdit && <span className="text-xs text-soft">Only the site owner can change testimonials.</span>}
      </div>

      {items.length === 0 ? <Empty title="No testimonials yet" hint="Until you add one and make it visible, the homepage shows no testimonials section." /> : (
        <div className="card divide-y divide-line">
          {items.map((t, i) => (
            <div key={t.id} className="flex flex-wrap items-start gap-3 px-4 py-3 text-[13px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {t.photoUrl ? <img src={t.photoUrl} alt="" className="h-10 w-10 shrink-0 rounded-full border border-line object-cover" /> : <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-line bg-muted text-xs font-semibold text-soft">{t.name.slice(0, 1).toUpperCase()}</div>}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2"><span className="font-medium">{t.name}</span><span className="text-soft">{[t.jobTitle, t.company].filter(Boolean).join(", ")}</span>{stars(t.rating)}<Badge value={t.visible ? "ACTIVE" : "SUSPENDED"} label={t.visible ? "Visible" : "Hidden"} /></div>
                <p className="mt-1 text-soft">&ldquo;{t.quote}&rdquo;</p>
              </div>
              {canEdit && (
                <div className="flex flex-wrap gap-1.5">
                  <button className="btn !px-2" aria-label="Move up" disabled={pending || i === 0} onClick={() => exec(() => moveTestimonialAction(t.id, "up"), refresh)}><ArrowUp className="h-3.5 w-3.5" /></button>
                  <button className="btn !px-2" aria-label="Move down" disabled={pending || i === items.length - 1} onClick={() => exec(() => moveTestimonialAction(t.id, "down"), refresh)}><ArrowDown className="h-3.5 w-3.5" /></button>
                  <button className="btn" disabled={pending} onClick={() => exec(() => setTestimonialVisibleAction(t.id, !t.visible), refresh)}>{t.visible ? "Hide" : "Show"}</button>
                  <button className="btn" onClick={() => open(t)}>Edit</button>
                  <button className="btn-danger" disabled={pending} onClick={() => { if (confirm(`Delete the testimonial from ${t.name}? This cannot be undone.`)) exec(() => deleteTestimonialAction(t.id), refresh); }}>Delete</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal open={dlg !== null} onClose={() => setDlg(null)} title={dlg === "new" ? "Add a testimonial" : "Edit testimonial"}>
        <div className="space-y-3 text-[13px]">
          <Field label="Quote"><textarea className="textarea" rows={4} maxLength={600} value={f.quote} onChange={(e) => setF({ ...f, quote: e.target.value })} placeholder="What they said, in their words." /></Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name"><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
            <Field label="Job title"><input className="input" value={f.jobTitle} onChange={(e) => setF({ ...f, jobTitle: e.target.value })} placeholder="Operations manager" /></Field>
            <Field label="Company"><input className="input" value={f.company} onChange={(e) => setF({ ...f, company: e.target.value })} /></Field>
            <Field label="Rating"><select className="input" value={f.rating ?? ""} onChange={(e) => setF({ ...f, rating: e.target.value ? Number(e.target.value) : null })}><option value="">No rating</option>{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} star{n === 1 ? "" : "s"}</option>)}</select></Field>
          </div>
          <div>
            <div className="mb-1.5 text-xs font-medium text-soft">Photo or company logo (optional)</div>
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {preview ? <img src={preview} alt="" className="h-12 w-12 rounded-full border border-line object-cover" /> : <div className="grid h-12 w-12 place-items-center rounded-full border border-dashed border-line text-[11px] text-soft">None</div>}
              <input ref={file} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => { choose(e.target.files?.[0]); e.target.value = ""; }} />
              <button type="button" className="btn" onClick={() => file.current?.click()}>{preview ? "Change" : "Choose a file"}</button>
              {preview && <button type="button" className="btn" onClick={() => { setPhoto(null); setPreview(null); }}>Remove</button>}
            </div>
            <p className="mt-1 text-xs text-soft">It is cropped to a square and shrunk for you.</p>
          </div>
          <label className="flex items-center gap-2"><input type="checkbox" checked={f.visible} onChange={(e) => setF({ ...f, visible: e.target.checked })} />Show on the homepage</label>
          <p className="text-xs text-soft">Only add a quote you have permission to publish. It is public as soon as it is visible.</p>
          <button className="btn-primary w-full" disabled={pending} onClick={save}>{dlg === "new" ? "Add testimonial" : "Save"}</button>
        </div>
      </Modal>
    </div>
  );
}
