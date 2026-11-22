import { CtaBand, PageShell } from "@/components/page-shell";

export const metadata = { title: "Solutions", description: "See how warehouses, restaurants, retail and community teams use OnboardOps to onboard, train and document.", alternates: { canonical: "/solutions" } };

const uses = [
  { t: "Warehouses and logistics", d: "Forklift and dock safety training, near-miss write-ups, and opening and closing walk-throughs for every shift. This is the setup our sample workspace uses.", needs: ["Equipment certification with retake cooldowns", "Strike points that suspend at a set limit", "Dock and floor checklists verified by a lead"] },
  { t: "Restaurants and food service", d: "Food-safety and allergen training before a new hire touches the line, plus attendance and conduct records that managers can point to later.", needs: ["Required courses per position", "Verbal and written warnings with signatures", "Opening and closing side-work checklists"] },
  { t: "Retail and front desk", d: "Cash handling, returns and loss-prevention training with a clear record of who completed it, and a place to keep corrective actions.", needs: ["Certificates by employee", "Compliance matrix for store managers", "Leave of absence and suspension statuses"] },
  { t: "Cleaning, field and trades crews", d: "Crew leads verify daily checklists from a phone, and owners see training gaps before sending someone to a job site.", needs: ["Mobile-friendly checklists", "Safety courses per job role", "Printable dossiers for client or insurer requests"] },
];

export default function Solutions() {
  return (
    <PageShell eyebrow="Solutions" title="Built for teams that run on shifts" intro="If people clock in, get trained on rules, and sometimes need a written record, this is for you.">
      <div className="space-y-4">
        {uses.map((u) => (
          <div key={u.t} className="card grid gap-4 p-5 md:grid-cols-[1fr_1fr]">
            <div><h2 className="text-lg font-semibold">{u.t}</h2><p className="mt-2 text-[13px] leading-relaxed text-soft">{u.d}</p></div>
            <ul className="space-y-1.5 text-[13px]">{u.needs.map((n) => <li key={n} className="flex gap-2"><span className="mono text-soft">+</span>{n}</li>)}</ul>
          </div>
        ))}
      </div>
      <p className="mt-6 text-[13px] text-soft">OnboardOps is a record-keeping tool. It does not give legal advice, and you remain responsible for your own employment practices.</p>
      <CtaBand />
    </PageShell>
  );
}
