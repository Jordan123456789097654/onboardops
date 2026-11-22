// Captures real screenshots of the running app (seeded demo data) for the marketing pages.
// Usage: start the app (npm run dev) with the seeded database, then: node scripts/screenshots.mjs
import { chromium } from "playwright-core";
import fs from "node:fs";

const BASE = process.env.BASE_URL || "http://localhost:3001";
const EXE = ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].find((p) => fs.existsSync(p));
const PASSWORD = "OnboardOps!2026"; // seeded demo password (see README)
const OUT = "public/screens";
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: EXE, headless: true });

async function session(theme, email) {
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 840 }, deviceScaleFactor: 1.5, colorScheme: theme });
  await ctx.addInitScript((t) => localStorage.setItem("oo-theme", t), theme);
  const page = await ctx.newPage();
  page.setDefaultTimeout(120000);
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', PASSWORD);
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/app\//);
  return { ctx, page };
}

async function shot(page, name, theme, path, prep) {
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
  if (prep) await prep(page);
  await page.waitForTimeout(2300);
  await page.screenshot({ path: `${OUT}/${name}-${theme}.jpg`, type: "jpeg", quality: 84 });
  console.log("saved", `${name}-${theme}`);
}

for (const theme of ["light", "dark"]) {
  const { ctx, page } = await session(theme, "dana@northside.example");
  await shot(page, "overview", theme, "/app/overview");
  await shot(page, "directory", theme, "/app/directory");
  await shot(page, "compliance", theme, "/app/training/compliance");
  await shot(page, "infractions", theme, "/app/infractions", async (p) => { await p.click("tbody tr"); await p.waitForTimeout(600); });
  await shot(page, "audit", theme, "/app/audit", async (p) => { await p.click("text=Verify chain"); await p.waitForTimeout(1500); });
  await shot(page, "schedule", theme, "/app/schedule");
  await shot(page, "timeoff", theme, "/app/requests", async (p) => { await p.click("button:has-text('Calendar')"); await p.waitForTimeout(600); });
  await shot(page, "appeals", theme, "/app/infractions", async (p) => { await p.click("tbody tr"); await p.waitForTimeout(700); await p.evaluate(() => { for (const e of document.querySelectorAll("*")) { if (e.closest("[role=dialog]") && e.scrollHeight > e.clientHeight + 50 && getComputedStyle(e).overflowY !== "visible") e.scrollTop = e.scrollHeight; } }); await p.waitForTimeout(500); });
  await shot(page, "checklists", theme, "/app/checklists");
  await shot(page, "settings", theme, "/app/settings");
  await shot(page, "training", theme, "/app/training");
  await shot(page, "dossier", theme, "/app/directory", async (p) => { await p.click("text=Devon Pruitt"); await p.waitForURL(/\/app\/employee\//); await p.addStyleTag({ content: "nextjs-portal{display:none!important}" }); });
  await shot(page, "course", theme, "/app/training", async (p) => { await p.click("a:has-text('Open') >> nth=0"); await p.waitForURL(/\/course\//); await p.addStyleTag({ content: "nextjs-portal{display:none!important}" }); });
  await ctx.close();
  const emp = await session(theme, "tomas@northside.example");
  await shot(emp.page, "portal", theme, "/app/my-portal");
  await emp.ctx.close();
}
await browser.close();
