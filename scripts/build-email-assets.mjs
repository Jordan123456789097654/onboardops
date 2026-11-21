// Draws the email illustrations as SVG, renders them to PNG with a local Chrome, and writes src/lib/email-assets.ts (base64) plus public/email/*.png.
// Email clients do not reliably show inline SVG, so the emails embed these PNGs. Usage: node scripts/build-email-assets.mjs
import { chromium } from "playwright-core";
import fs from "node:fs";

const EXE = ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].find((p) => fs.existsSync(p));
const INK = "#0B1220", ACC = "#1D4ED8", SOFT = "#DBEAFE", WHITE = "#FFFFFF", AMBER = "#F59E0B", AMBER_S = "#FEF3C7", GREEN = "#059669", GREEN_S = "#D1FAE5", ROSE = "#E11D48", ROSE_S = "#FFE4E6";

const blob = (c) => `<path d="M16 60C14 34 36 16 62 18c26 2 44 20 42 46-2 26-22 40-46 40S18 86 16 60z" fill="${c}" stroke="none"/>`;
const wrap = (inner) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
const person = (x = 0, fill = WHITE) => `<circle cx="${52 + x}" cy="46" r="14" fill="${fill}"/><path d="M${24 + x} 94c2-18 14-28 28-28s26 10 28 28z" fill="${fill}"/>`;
const badge = (c, mark) => `<circle cx="90" cy="38" r="15" fill="${c}"/>${mark}`;
const plus = `<path d="M90 31v14M83 38h14" stroke="${WHITE}" stroke-width="3.5"/>`;
const tick = (x, y, c = WHITE) => `<path d="M${x} ${y}l5 5 9-10" stroke="${c}" stroke-width="3.5"/>`;

const icons = {
  magic: wrap(`${blob(SOFT)}<path d="M60 20l8 22 22 8-22 8-8 22-8-22-22-8 22-8z" fill="${WHITE}"/><path d="M60 20l8 22 22 8-22 8-8 22-8-22-22-8 22-8z" fill="${AMBER_S}"/><path d="M92 74l3 8 8 3-8 3-3 8-3-8-8-3 8-3zM26 80l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="${ACC}"/>`),
  verify: wrap(`${blob(SOFT)}<rect x="22" y="42" width="70" height="46" rx="7" fill="${WHITE}"/><path d="M25 47l32 24 32-24"/>${badge(ACC, tick(83, 38))}`),
  key: wrap(`${blob(AMBER_S)}<circle cx="44" cy="50" r="18" fill="${WHITE}"/><circle cx="44" cy="50" r="6" fill="${AMBER}"/><path d="M57 63l33 33M75 81l9-9M83 89l8-8"/>`),
  invite: wrap(`${blob(SOFT)}${person()}${badge(ACC, plus)}`),
  welcome: wrap(`${blob(GREEN_S)}${person(2)}<path d="M92 24v14M85 31h14M26 34v9M21.5 38.5h9" stroke="${AMBER}" stroke-width="3.5"/>`),
  team: wrap(`${blob(SOFT)}<circle cx="74" cy="46" r="12" fill="${SOFT}"/><path d="M56 92c2-14 10-22 20-22s20 8 22 22z" fill="${SOFT}"/>${person(-8)}`),
  book: wrap(`${blob(SOFT)}<path d="M60 38c-10-8-26-9-38-4v50c12-5 28-4 38 4 10-8 26-9 38-4V34c-12-5-28-4-38 4z" fill="${WHITE}"/><path d="M60 38v50M30 50c8-2 16-2 22 1M30 62c8-2 16-2 22 1M68 51c6-3 14-3 22-1M68 63c6-3 14-3 22-1"/><path d="M92 14l3.5 7.5 8 1-6 5.5 1.8 8-7.3-4-7.3 4 1.8-8-6-5.5 8-1z" fill="${AMBER}"/>`),
  clock: wrap(`${blob(AMBER_S)}<circle cx="60" cy="64" r="29" fill="${WHITE}"/><path d="M60 46v18l12 9"/><path d="M30 40c-7-6-8-14-2-20M90 40c7-6 8-14 2-20M46 94l-7 9M74 94l7 9"/>`),
  alert: wrap(`${blob(ROSE_S)}<rect x="32" y="28" width="56" height="68" rx="7" fill="${WHITE}"/><rect x="47" y="20" width="26" height="14" rx="5" fill="${AMBER_S}"/><path d="M60 48v20"/><circle cx="60" cy="79" r="2.2" fill="${INK}"/><path d="M42 88h36" stroke="${ROSE}"/>`),
  pen: wrap(`${blob(SOFT)}<path d="M30 22h42l18 18v56H30z" fill="${WHITE}"/><path d="M72 22v18h18M40 52h30M40 62h22"/><path d="M38 84c6-8 10 4 14-4s6-6 10 2 6-6 10-2" stroke="${ACC}"/><path d="M84 62l12 12-24 24-14 3 3-14z" fill="${AMBER_S}"/>`),
  chat: wrap(`${blob(SOFT)}<path d="M22 32h50a8 8 0 0 1 8 8v20a8 8 0 0 1-8 8H44L30 82V68h-8a8 8 0 0 1-8-8V40a8 8 0 0 1 8-8z" fill="${WHITE}"/><path d="M30 46h34M30 56h22"/><path d="M88 52h8a8 8 0 0 1 8 8v16a8 8 0 0 1-8 8h-2v12l-12-12H70a8 8 0 0 1-8-8v-1" fill="${ACC}"/><path d="M80 68h14" stroke="${WHITE}"/>`),
  eye: wrap(`${blob(SOFT)}<path d="M12 64c12-20 28-30 48-30s36 10 48 30c-12 20-28 30-48 30S24 84 12 64z" fill="${WHITE}"/><circle cx="60" cy="64" r="15" fill="${ACC}"/><circle cx="60" cy="64" r="5.5" fill="${INK}"/><path d="M60 14v10M32 24l6 7M88 24l-6 7"/>`),
  lock: wrap(`${blob(ROSE_S)}<rect x="30" y="54" width="58" height="42" rx="8" fill="${WHITE}"/><path d="M42 54V42a17 17 0 0 1 34 0v12"/><circle cx="59" cy="73" r="5.5" fill="${ROSE}"/><path d="M59 78v8"/>`),
  unlock: wrap(`${blob(GREEN_S)}<rect x="30" y="54" width="58" height="42" rx="8" fill="${WHITE}"/><path d="M42 54V42a17 17 0 0 1 32-8"/><circle cx="59" cy="73" r="5.5" fill="${GREEN}"/><path d="M59 78v8"/>`),
  seal: wrap(`${blob(GREEN_S)}<path d="M44 74l-8 28 16-8 8 10 4-26M76 74l8 28-16-8" fill="${ACC}"/><circle cx="60" cy="52" r="28" fill="${WHITE}"/><circle cx="60" cy="52" r="19"/><path d="M50 52l8 8 14-16" stroke="${GREEN}" stroke-width="4"/>`),
  calendar: wrap(`${blob(SOFT)}<rect x="24" y="34" width="72" height="62" rx="9" fill="${WHITE}"/><path d="M24 56h72M44 26v14M76 26v14"/><path d="M48 78l9 9 17-19" stroke="${ACC}" stroke-width="4"/>`),
  shield: wrap(`${blob(GREEN_S)}<path d="M60 20l33 12v27c0 21-14 35-33 44-19-9-33-23-33-44V32z" fill="${WHITE}"/><path d="M45 62l11 11 19-22" stroke="${GREEN}" stroke-width="4"/>`),
};

const logo = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32"><rect width="32" height="32" rx="8" fill="${ACC}"/><circle cx="16" cy="16" r="8.5" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-dasharray="43 10.4" transform="rotate(-20 16 16)"/><path d="M12.2 16.4l2.7 2.7 6.4-7.1" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

const browser = await chromium.launch({ executablePath: EXE, headless: true });
const ctx = await browser.newContext({ deviceScaleFactor: 2 });
const page = await ctx.newPage();
fs.mkdirSync("public/email", { recursive: true });
const out = {};

async function render(name, svg, size) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:transparent"><div style="width:${size}px;height:${size}px">${svg.replace(/width="\d+" height="\d+"/, `width="${size}" height="${size}"`)}</div></body></html>`);
  const buf = await page.screenshot({ type: "png", omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
  fs.writeFileSync(`public/email/${name}.png`, buf);
  out[name] = buf.toString("base64");
}

for (const [name, svg] of Object.entries(icons)) await render(name, svg, 96);
await render("logo", logo, 36);
await browser.close();

const ts = `// Generated by scripts/build-email-assets.mjs. Do not edit by hand.\n/* eslint-disable */\nexport const EMAIL_IMAGES: Record<string, string> = {\n${Object.entries(out).map(([k, v]) => `  ${JSON.stringify(k)}: "${v}",`).join("\n")}\n};\nexport type EmailIcon = ${Object.keys(icons).map((k) => JSON.stringify(k)).join(" | ")};\n`;
fs.writeFileSync("src/lib/email-assets.ts", ts);
console.log(`Rendered ${Object.keys(out).length} images (${Math.round(ts.length / 1024)} KB of base64).`);
