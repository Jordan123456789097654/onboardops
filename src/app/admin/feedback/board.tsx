"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { updateRequestAction } from "@/actions/admin";
import { Empty, PageHeader, useAction } from "@/components/ui";
import { fmtDate } from "@/lib/utils";

type Card = { id: string; ref: string; name: string; message: string; workspaceId: string | null; workspace: string | null; status: string; at: string };
const cols = [["NEW", "New"], ["PLANNED", "Planned"], ["DONE", "Shipped"], ["DECLINED", "Not planned"]] as const;

export function Board({ cards }: { cards: Card[] }) {
  const router = useRouter();
  const { exec, pending } = useAction();
  const move = (id: string, boardStatus: string) => exec(() => updateRequestAction(id, { boardStatus }), { onOk: () => router.refresh() });
  return (
    <>
      <PageHeader title="Beta feedback" sub="Feedback from testers, tied to the workspace it came from. Move cards as you decide." />
      {cards.length === 0 ? <Empty title="No feedback yet" hint="Testers send it from the Send feedback button inside the app, or from the contact form with the topic Feedback." /> : (
        <div className="grid gap-4 lg:grid-cols-4">
          {cols.map(([id, label]) => {
            const list = cards.filter((c) => c.status === id);
            return (
              <section key={id} className="min-w-0">
                <h2 className="mb-2 flex items-center justify-between text-sm font-semibold">{label}<span className="mono text-xs text-soft">{list.length}</span></h2>
                <div className="space-y-2">
                  {list.map((c, i) => (
                    <div key={c.id} style={{ "--i": i } as React.CSSProperties} className="card anim-fade-up p-3 text-[13px]">
                      <p className="whitespace-pre-wrap leading-relaxed">{c.message.length > 280 ? c.message.slice(0, 280) + "…" : c.message}</p>
                      <div className="mt-2 text-xs text-soft">{c.name} · {c.workspaceId ? <Link className="text-accent" href={`/admin/workspaces/${c.workspaceId}`}>{c.workspace ?? "workspace"}</Link> : "no workspace"} · <span className="mono">{fmtDate(c.at)}</span></div>
                      <div className="mt-2 flex flex-wrap gap-1">{cols.filter(([s]) => s !== id).map(([s, l]) => <button key={s} className="btn !h-6 !px-2 !text-[11px]" disabled={pending} onClick={() => move(c.id, s)}>{l}</button>)}<Link className="btn !h-6 !px-2 !text-[11px]" href={`/admin/inbox?open=${c.id}`}>Open</Link></div>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
