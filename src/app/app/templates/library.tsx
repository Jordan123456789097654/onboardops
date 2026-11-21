"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { installLibraryAction } from "@/actions/library";
import { PageHeader, useAction, useToast } from "@/components/ui";
import { cn } from "@/lib/utils";

type Group = { kind: "courses" | "policies" | "checklists" | "cases"; title: string; note: string; items: { id: string; title: string; desc: string; added: boolean }[] };

export function Library({ groups }: { groups: Group[] }) {
  const router = useRouter();
  const toast = useToast();
  const { exec, pending } = useAction();
  const [sel, setSel] = useState<Record<string, string[]>>({});
  const count = Object.values(sel).reduce((n, a) => n + a.length, 0);
  const toggle = (k: string, id: string) => setSel((s) => ({ ...s, [k]: (s[k] ?? []).includes(id) ? (s[k] ?? []).filter((x) => x !== id) : [...(s[k] ?? []), id] }));
  const all = () => setSel(Object.fromEntries(groups.map((g) => [g.kind, g.items.filter((i) => !i.added).map((i) => i.id)])));
  return (
    <>
      <PageHeader title="Templates library" sub="Add ready-made courses, policies, checklists and corrective-action wording. They are starting points, not legal advice: review and adapt them.">
        <button className="btn" onClick={all}>Select everything new</button>
        <button className="btn-primary" disabled={pending || count === 0} onClick={() => exec(() => installLibraryAction(sel), { onOk: (r) => { toast("ok", `Added ${r.courses} course(s), ${r.policies} policy(ies), ${r.checklists} checklist(s), ${r.cases} template(s)${r.skipped ? `. ${r.skipped} already existed.` : ""}`); setSel({}); router.refresh(); } })}>{pending ? "Adding…" : `Add ${count} selected`}</button>
      </PageHeader>
      <div className="space-y-8">
        {groups.map((g) => (
          <section key={g.kind}>
            <h2 className="text-sm font-semibold">{g.title}</h2><p className="mb-2 text-xs text-soft">{g.note}</p>
            <div className="grid gap-2 md:grid-cols-2">
              {g.items.map((i) => { const on = (sel[g.kind] ?? []).includes(i.id); return (
                <button key={i.id} disabled={i.added} onClick={() => toggle(g.kind, i.id)} className={cn("card flex items-start gap-3 p-3 text-left transition-colors", i.added ? "opacity-60" : on ? "border-accent bg-muted" : "hover:bg-muted")}>
                  <span className={cn("mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border", on || i.added ? "border-accent bg-accent text-accent-fg" : "border-line")}>{(on || i.added) && <Check className="h-3.5 w-3.5" />}</span>
                  <span className="min-w-0"><span className="block text-[13px] font-medium">{i.title}{i.added && <span className="ml-2 text-xs font-normal text-soft">Already added</span>}</span><span className="block text-xs text-soft">{i.desc}</span></span>
                </button>); })}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
