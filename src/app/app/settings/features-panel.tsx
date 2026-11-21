"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveFeaturesAction } from "@/actions/features";
import { FEATURES } from "@/lib/features";
import { useAction } from "@/components/ui";
import { cn } from "@/lib/utils";

export function FeaturesPanel({ initial }: { initial: Record<string, boolean> }) {
  const router = useRouter();
  const { exec, pending } = useAction();
  const [map, setMap] = useState<Record<string, boolean>>(() => Object.fromEntries(FEATURES.map((f) => [f.key, typeof initial[f.key] === "boolean" ? initial[f.key] : f.defaultOn])));
  const groups = Array.from(new Set(FEATURES.map((f) => f.group)));
  const dirty = FEATURES.some((f) => map[f.key] !== (typeof initial[f.key] === "boolean" ? initial[f.key] : f.defaultOn));
  return (
    <div className="space-y-6">
      <p className="text-[13px] text-soft">Turn features on or off for your whole workspace. A feature that is off disappears from the menu and its pages and actions stop working. Existing records are kept.</p>
      {groups.map((g) => (
        <section key={g}>
          <h2 className="mb-2 text-sm font-semibold">{g}</h2>
          <div className="card divide-y divide-line">
            {FEATURES.filter((f) => f.group === g).map((f) => (
              <label key={f.key} className="flex cursor-pointer items-start gap-3 px-4 py-3">
                <div className="min-w-0 flex-1"><div className="text-[13px] font-medium">{f.label}</div><p className="mt-0.5 text-xs text-soft">{f.description}</p></div>
                <button type="button" role="switch" aria-checked={map[f.key]} aria-label={f.label} onClick={() => setMap({ ...map, [f.key]: !map[f.key] })} className={cn("relative mt-0.5 h-6 w-11 shrink-0 rounded-full border transition-colors", map[f.key] ? "border-accent bg-accent" : "border-line bg-muted")}>
                  <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all", map[f.key] ? "left-[22px]" : "left-0.5")} />
                </button>
              </label>
            ))}
          </div>
        </section>
      ))}
      <div className="sticky bottom-3 flex items-center gap-3 rounded-lg border border-line bg-surface p-3 shadow-lg"><button className="btn-primary" disabled={pending || !dirty} onClick={() => exec(() => saveFeaturesAction(map), { success: "Features saved", onOk: () => router.refresh() })}>Save changes</button>{dirty && <span className="text-xs text-soft">You have unsaved changes.</span>}</div>
    </div>
  );
}
