"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { setRoadmapItemAction } from "@/actions/roadmap";
import { Badge, useAction } from "@/components/ui";

type Row = { id: string; message: string; status: string; title: string; blurb: string; votes: number };

function Item({ r }: { r: Row }) {
  const router = useRouter();
  const { exec, pending } = useAction();
  const [title, setTitle] = useState(r.title);
  const [blurb, setBlurb] = useState(r.blurb);
  return (
    <div className="card space-y-2 p-3 text-[13px]">
      <div className="flex items-center gap-2"><Badge value={r.status === "DONE" ? "PASSED" : r.status === "PLANNED" ? "PENDING" : "LOA"} label={r.status} />{r.title && <span className="mono text-xs text-soft">published · {r.votes} votes</span>}</div>
      <p className="whitespace-pre-wrap text-soft">{r.message}</p>
      <input className="input" placeholder="Public title (blank = not on roadmap)" maxLength={100} value={title} onChange={(e) => setTitle(e.target.value)} />
      <textarea className="textarea" rows={2} placeholder="One or two sentences for the public (no names or private details)" maxLength={400} value={blurb} onChange={(e) => setBlurb(e.target.value)} />
      <button className="btn" disabled={pending} onClick={() => exec(() => setRoadmapItemAction(r.id, { title, blurb }), { success: title ? "Published" : "Removed", onOk: () => router.refresh() })}>Save</button>
    </div>
  );
}

export function RoadmapEditor({ rows }: { rows: Row[] }) {
  return <div className="grid gap-3 lg:grid-cols-2">{rows.map((r) => <Item key={r.id} r={r} />)}</div>;
}
