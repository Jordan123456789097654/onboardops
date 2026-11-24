import type { CertificateData } from "@/lib/certificate";

const NAVY = "#14213d";
const GOLD = "#b28d3d";
const GOLD_LIGHT = "#e6d199";

const long = (d: Date) => d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });

function Seal() {
  const dots = Array.from({ length: 32 }, (_, i) => {
    const a = (i / 32) * Math.PI * 2;
    return <circle key={i} cx={Math.cos(a) * 40} cy={Math.sin(a) * 40} r={5.2} fill={GOLD} />;
  });
  return (
    <svg viewBox="-50 -50 100 130" style={{ width: "100%", height: "100%", overflow: "visible" }} aria-hidden>
      <path d="M-30,8 L-4,8 L0,70 L-17,56 L-34,70 Z" fill={NAVY} />
      <path d="M4,8 L30,8 L34,70 L17,56 L0,70 Z" fill={NAVY} />
      {dots}
      <circle r={40} fill={GOLD} />
      <circle r={35} fill={GOLD_LIGHT} />
      <circle r={33} fill={GOLD} />
      <circle r={28} fill={NAVY} />
      <circle r={25} fill="none" stroke={GOLD_LIGHT} strokeWidth={0.8} />
      <path d="M-13,1 L-4,10 L14,-9" fill="none" stroke="#fff" strokeWidth={4.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Corner({ pos }: { pos: "tl" | "tr" | "bl" | "br" }) {
  const v = pos[0] === "t" ? { top: "7.5%" } : { bottom: "7.5%" };
  const h = pos[1] === "l" ? { left: "5.8%" } : { right: "5.8%" };
  return (
    <span aria-hidden style={{ position: "absolute", width: "4.3%", aspectRatio: "1", ...v, ...h, borderColor: GOLD, borderStyle: "solid", borderWidth: 0, [`border${pos[0] === "t" ? "Top" : "Bottom"}Width`]: "0.2cqw", [`border${pos[1] === "l" ? "Left" : "Right"}Width`]: "0.2cqw" } as React.CSSProperties} />
  );
}

/** A letter-size landscape certificate. Sizes scale with the page width, so it looks the same on screen and on paper. */
export function CertificateSheet({ c, qr }: { c: CertificateData; qr: string }) {
  const expired = c.expires && c.expires < new Date();
  const nameSize = c.employeeName.length > 34 ? "3.5cqw" : "4.8cqw";
  const courseSize = c.courseTitle.length > 70 ? "2.4cqw" : c.courseTitle.length > 40 ? "2.9cqw" : "3.3cqw";
  const caps = (extra: React.CSSProperties): React.CSSProperties => ({ textTransform: "uppercase", ...extra });
  return (
    <div className="cert-sheet" style={{ containerType: "inline-size", position: "relative", width: "100%", aspectRatio: "11 / 8.5", background: "#fff", color: "#1a1a1f", fontFamily: "'Times New Roman', Times, 'Liberation Serif', serif", overflow: "hidden", WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}>
      <div aria-hidden style={{ position: "absolute", inset: "2.8%", border: `0.45cqw solid ${NAVY}` }} />
      <div aria-hidden style={{ position: "absolute", inset: "4%", border: `0.13cqw solid ${GOLD}` }} />
      <div aria-hidden style={{ position: "absolute", inset: "4.5%", border: `0.07cqw solid ${NAVY}` }} />
      <Corner pos="tl" /><Corner pos="tr" /><Corner pos="bl" /><Corner pos="br" />

      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", paddingTop: "7%" }}>
        <div style={caps({ fontFamily: "Helvetica, Arial, sans-serif", fontWeight: 700, fontSize: "1.4cqw", letterSpacing: "0.33cqw", color: NAVY, maxWidth: "70%" })}>{c.workspaceName}</div>
        <div style={{ display: "flex", alignItems: "center", gap: "1cqw", margin: "1.3cqw 0 2cqw" }}>
          <span style={{ width: "12.5cqw", height: "0.1cqw", background: GOLD }} />
          <span style={{ width: "0.7cqw", height: "0.7cqw", background: GOLD, transform: "rotate(45deg)" }} />
          <span style={{ width: "12.5cqw", height: "0.1cqw", background: GOLD }} />
        </div>
        <div style={caps({ fontWeight: 700, fontSize: "5.8cqw", letterSpacing: "0.6cqw", color: NAVY, lineHeight: 1 })}>Certificate</div>
        <div style={caps({ fontFamily: "Helvetica, Arial, sans-serif", fontWeight: 700, fontSize: "1.6cqw", letterSpacing: "0.65cqw", color: GOLD, marginTop: "1.3cqw" })}>of Completion</div>

        <div style={{ fontStyle: "italic", fontSize: "1.9cqw", color: "#61616b", marginTop: "3.9cqw" }}>This certifies that</div>
        <div style={{ fontStyle: "italic", fontWeight: 700, fontSize: nameSize, lineHeight: 1.15, marginTop: "1.2cqw", padding: "0 5cqw 0.7cqw", borderBottom: `0.12cqw solid ${GOLD}`, minWidth: "38%", maxWidth: "84%" }}>{c.employeeName}</div>
        <div style={{ fontFamily: "'Courier New', monospace", fontWeight: 700, fontSize: "1.2cqw", color: "#61616b", marginTop: "0.8cqw" }}>{c.staffCode}</div>

        <div style={{ fontStyle: "italic", fontSize: "1.85cqw", color: "#61616b", marginTop: "2.2cqw" }}>has successfully completed the training course</div>
        <div style={{ fontWeight: 700, fontSize: courseSize, color: NAVY, marginTop: "1cqw", maxWidth: "78%", lineHeight: 1.18 }}>{c.courseTitle}</div>
        <div style={{ fontFamily: "Helvetica, Arial, sans-serif", fontSize: "1.4cqw", color: "#61616b", marginTop: "1.6cqw" }}>with a score of {c.score}% &nbsp;·&nbsp; passing score {c.passingScore}%</div>
      </div>

      {/* Date, seal, signature */}
      <div style={{ position: "absolute", left: "12%", width: "25.5%", bottom: "19.6%", textAlign: "center" }}>
        <div style={{ fontSize: "1.65cqw", paddingBottom: "0.5cqw", borderBottom: "0.1cqw solid #1a1a1f" }}>{long(c.issued)}</div>
        <div style={{ fontFamily: "Helvetica, Arial, sans-serif", fontSize: "1.15cqw", color: "#61616b", marginTop: "0.8cqw" }}>Date issued</div>
      </div>
      <div style={{ position: "absolute", left: "62.8%", width: "25.2%", bottom: "19.6%", textAlign: "center" }}>
        <div style={{ height: "2.2cqw", borderBottom: "0.1cqw solid #1a1a1f" }} />
        <div style={{ fontFamily: "Helvetica, Arial, sans-serif", fontSize: "1.15cqw", color: "#61616b", marginTop: "0.8cqw" }}>Authorized signature</div>
        <div style={{ fontFamily: "Helvetica, Arial, sans-serif", fontSize: "1.08cqw", color: "#61616b", marginTop: "0.3cqw" }}>{c.workspaceName}</div>
      </div>
      <div style={{ position: "absolute", left: "44.2%", width: "11.6%", bottom: "10.6%", aspectRatio: "100 / 130" }}><Seal /></div>

      {/* QR, number, expiry */}
      <div style={{ position: "absolute", left: "7.8%", bottom: "9.3%", display: "flex", alignItems: "center", gap: "1.3cqw" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qr} alt={`QR code for ${c.verifyUrl}`} style={{ width: "7.4cqw", height: "7.4cqw" }} />
        <div style={{ textAlign: "left" }}>
          <div style={{ fontFamily: "Helvetica, Arial, sans-serif", fontWeight: 700, fontSize: "0.95cqw", color: "#61616b", letterSpacing: "0.06cqw" }}>CERTIFICATE NUMBER</div>
          <div style={{ fontFamily: "'Courier New', monospace", fontWeight: 700, fontSize: "1.9cqw", color: NAVY, lineHeight: 1.3 }}>{c.code}</div>
          <div style={{ fontFamily: "Helvetica, Arial, sans-serif", fontSize: "0.95cqw", color: "#61616b" }}>Scan or visit onboardops.org/verify to confirm it is real</div>
        </div>
      </div>
      {c.expires && (
        <div style={{ position: "absolute", right: "7.8%", bottom: "13.4%", fontFamily: "Helvetica, Arial, sans-serif", fontWeight: 700, fontSize: "1.1cqw", color: expired ? "#9f1239" : NAVY }}>
          {expired ? "EXPIRED" : "VALID UNTIL"}&nbsp; {long(c.expires).toUpperCase()}
        </div>
      )}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: "5.5%", textAlign: "center", fontFamily: "Helvetica, Arial, sans-serif", fontSize: "0.9cqw", color: "#61616b" }}>
        Issued through OnboardOps. This confirms a training course was passed. Check with the employer for current qualification.
      </div>
    </div>
  );
}
