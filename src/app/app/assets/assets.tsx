"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { checkoutAssetAction, deleteAssetAction, returnAssetAction, saveAssetAction } from "@/actions/operations";
import { Badge, Empty, Field, Modal, PageHeader, useAction } from "@/components/ui";
import { fmtDateTime } from "@/lib/utils";

type AssetRow = {
  id: string;
  name: string;
  tag: string;
  category: string;
  checkoutId: string | null;
  holder: string | null;
  outAt: string | null;
  condition: string;
};

export function Assets({ assets, employees }: { assets: AssetRow[]; employees: { id: string; label: string }[] }) {
  const router = useRouter();
  const { exec, pending } = useAction();
  const [addOpen, setAddOpen] = useState(false);
  const [outAsset, setOutAsset] = useState<AssetRow | null>(null);
  const [f, setF] = useState({ name: "", tag: "", category: "Equipment" });
  const [co, setCo] = useState({ employeeId: "", condition: "Good" });

  return (
    <>
      <PageHeader title="Equipment Sign-Out" sub="Track who has which tool, key, radio or vehicle.">
        <button className="btn-primary" onClick={() => setAddOpen(true)}>Add equipment</button>
      </PageHeader>
      {assets.length === 0 ? (
        <Empty title="No equipment registered" hint="Add tools, keys, radios or vehicles to track sign-outs." />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse">
            <thead>
              <tr>
                {["Tag", "Name", "Category", "Status", "Signed out to", "Condition", ""].map((h) => (
                  <th key={h} className="th">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {assets.map((a) => (
                <tr key={a.id} className="hover:bg-muted">
                  <td className="td mono font-medium">{a.tag}</td>
                  <td className="td font-medium">{a.name}</td>
                  <td className="td">{a.category}</td>
                  <td className="td">{a.checkoutId ? <Badge value="PENDING" label="Signed out" /> : <Badge value="ACTIVE" label="Available" />}</td>
                  <td className="td">{a.holder ? <div><div>{a.holder}</div><div className="mono text-[11px] text-soft">{fmtDateTime(a.outAt)}</div></div> : "—"}</td>
                  <td className="td text-soft">{a.condition || "—"}</td>
                  <td className="td text-right">
                    <div className="flex items-center justify-end gap-2">
                      {a.checkoutId ? (
                        <button
                          className="btn !h-7 !text-xs"
                          disabled={pending}
                          onClick={() => exec(() => returnAssetAction(a.checkoutId!), { success: "Checked back in", onOk: () => router.refresh() })}
                        >
                          Check in
                        </button>
                      ) : (
                        <button className="btn !h-7 !text-xs" onClick={() => setOutAsset(a)}>Sign out…</button>
                      )}
                      <button
                        className="btn !px-2"
                        aria-label="Delete equipment"
                        disabled={pending}
                        onClick={() => exec(() => deleteAssetAction(a.id), { success: "Removed", onOk: () => router.refresh() })}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add equipment">
        <div className="space-y-3">
          <Field label="Name"><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Forklift Key #2" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tag / ID"><input className="input mono" value={f.tag} onChange={(e) => setF({ ...f, tag: e.target.value })} placeholder="EQ-002" /></Field>
            <Field label="Category"><input className="input" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} placeholder="Keys / Radios / Vehicles" /></Field>
          </div>
          <button
            className="btn-primary w-full"
            disabled={pending || !f.name.trim() || !f.tag.trim()}
            onClick={() => exec(() => saveAssetAction(f), { success: "Equipment added", onOk: () => { setAddOpen(false); setF({ name: "", tag: "", category: "Equipment" }); router.refresh(); } })}
          >
            Save equipment
          </button>
        </div>
      </Modal>

      <Modal open={!!outAsset} onClose={() => setOutAsset(null)} title={outAsset ? `Sign out ${outAsset.name}` : ""}>
        {outAsset && (
          <div className="space-y-3">
            <Field label="Employee">
              <select className="input" value={co.employeeId} onChange={(e) => setCo({ ...co, employeeId: e.target.value })}>
                <option value="">Select employee…</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>{e.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Condition note">
              <input className="input" value={co.condition} onChange={(e) => setCo({ ...co, condition: e.target.value })} />
            </Field>
            <button
              className="btn-primary w-full"
              disabled={pending || !co.employeeId}
              onClick={() => exec(() => checkoutAssetAction({ assetId: outAsset.id, employeeId: co.employeeId, condition: co.condition }), { success: "Signed out", onOk: () => { setOutAsset(null); router.refresh(); } })}
            >
              Confirm sign-out
            </button>
          </div>
        )}
      </Modal>
    </>
  );
}
