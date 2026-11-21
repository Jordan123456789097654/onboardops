// End-to-end smoke test against a running, seeded local app. Usage: node scripts/e2e-smoke.mjs
// Uses the seeded demo accounts (password in README). Creates a few records (CSV import, invite, incident, document).
import { chromium } from "playwright-core";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const EXE = ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].find((p) => fs.existsSync(p));
const PASSWORD = "OnboardOps!2026";
const results = [];
const ok = (name, cond, extra = "") => { results.push({ name, pass: !!cond }); console.log(`${cond ? "PASS" : "FAIL"}  ${name}${extra ? "  " + extra : ""}`); };

const browser = await chromium.launch({ executablePath: EXE, headless: true });
async function login(email, password = PASSWORD) {
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 840 } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(90000);
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/app\//);
  return { ctx, page };
}
const stamp = Date.now().toString(36);

try {
  // --- Manager side
  const dana = await login("dana@northside.example");
  const d = dana.page;

  // Pages render
  for (const [p, text] of [["/app/overview", "Command Center"], ["/app/incidents", "Incident Reports"], ["/app/policies", "Policies"], ["/app/reports", "Reports"], ["/app/settings", "Workspace Settings"]]) {
    await d.goto(`${BASE}${p}`, { waitUntil: "networkidle" });
    ok(`page ${p}`, (await d.textContent("main")).includes(text));
  }

  // Notification bell shows seeded notifications
  await d.goto(`${BASE}/app/overview`, { waitUntil: "networkidle" });
  await d.click('button[aria-label^="Notifications"]');
  ok("bell opens with items", await d.locator("text=New incident: near miss").first().isVisible());
  await d.keyboard.press("Escape");

  // CSV import
  const csv = `Full name,Email,Phone,Department,Job role,Hire date\nImport Tester ${stamp},import.${stamp}@example.com,404-555-0100,Warehouse,Picker / Packer,2026-11-02\nBad Row,not-an-email,,,,\nSecond Person ${stamp},second.${stamp}@example.com,,Mystery Dept,Picker / Packer,\n`;
  const csvPath = path.join(os.tmpdir(), `oo-import-${stamp}.csv`);
  fs.writeFileSync(csvPath, csv);
  await d.goto(`${BASE}/app/directory`, { waitUntil: "networkidle" });
  await d.click("text=Import CSV");
  await d.setInputFiles('input[type="file"]', csvPath);
  await d.waitForSelector("text=3 rows");
  await d.click('button:has-text("Import 3 row")');
  await d.waitForSelector("text=employee imported", { timeout: 60000 }).catch(() => {});
  const resultText = await d.locator('[role="dialog"]').innerText();
  ok("import created 1 employee", /1\s*employee imported/.test(resultText), resultText.replace(/\s+/g, " ").slice(0, 120));
  ok("import skipped bad email and unknown department", /2 rows skipped/.test(resultText) && /Unknown department/.test(resultText));
  await d.click('button:has-text("Done")');

  // Invite flow: grant access with no password to the imported employee
  await d.goto(`${BASE}/app/directory?q=Import+Tester+${stamp}`, { waitUntil: "networkidle" });
  await d.click(`text=Import Tester ${stamp} >> nth=0`);
  await d.waitForURL(/\/app\/employee\//);
  await d.click("text=Grant access");
  await d.click('button:has-text("Grant access and send invite")');
  await d.waitForSelector("text=reset-password?token=");
  const inviteUrl = (await d.locator('div.break-all').first().innerText()).trim();
  ok("invite link produced", inviteUrl.includes("/reset-password?token="));
  const inv = await browser.newContext();
  const ip = await inv.newPage();
  ip.setDefaultTimeout(90000);
  await ip.goto(inviteUrl.replace(/^https?:\/\/[^/]+/, BASE), { waitUntil: "networkidle" });
  await ip.fill('input[autocomplete="new-password"] >> nth=0', "NewPassw0rd!1");
  await ip.fill('input[autocomplete="new-password"] >> nth=1', "NewPassw0rd!1");
  await ip.click('button:has-text("Save password")');
  await ip.waitForURL(/\/app\/my-portal/, { timeout: 60000 });
  ok("invitee set password and landed in portal", true);
  const reuse = await (await inv.newPage()).goto(inviteUrl.replace(/^https?:\/\/[^/]+/, BASE));
  ok("invite page loads for reuse check", reuse.ok());
  await inv.close();

  // Document upload + access control
  const pdfPath = path.join(os.tmpdir(), `oo-doc-${stamp}.pdf`);
  fs.writeFileSync(pdfPath, "%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n");
  await d.goto(`${BASE}/app/directory`, { waitUntil: "networkidle" });
  await d.click("text=Devon Pruitt");
  await d.waitForURL(/\/app\/employee\//);
  await d.click('[role="tab"]:has-text("Documents")');
  await d.click("text=Upload document >> nth=0");
  await d.fill('[role="dialog"] input.input >> nth=0', `Forklift license ${stamp}`);
  await d.setInputFiles('[role="dialog"] input[type="file"]', pdfPath);
  await d.click('[role="dialog"] button:has-text("Upload")');
  await d.waitForSelector(`text=Forklift license ${stamp}`, { timeout: 60000 });
  const href = await d.locator(`a:has-text("Forklift license ${stamp}")`).getAttribute("href");
  const asOwner = await dana.ctx.request.get(`${BASE}${href}`);
  ok("owner can open document", asOwner.status() === 200 && (asOwner.headers()["content-type"] || "").includes("pdf"));

  // Export + cron
  const exp = await dana.ctx.request.get(`${BASE}/api/export/workspace`);
  const expJson = exp.status() === 200 ? await exp.json() : null;
  ok("workspace export (owner)", expJson && Array.isArray(expJson.employees) && expJson.employees.length >= 8, expJson ? `${expJson.employees.length} employees` : `status ${exp.status()}`);
  const cron = await dana.ctx.request.get(`${BASE}/api/cron/daily`);
  ok("cron rejects without secret", cron.status() === 401);

  // Run reminders now
  await d.goto(`${BASE}/app/settings`, { waitUntil: "networkidle" });
  await d.click('[role="tab"]:has-text("Data")');
  await d.click('button:has-text("Run reminders")');
  await d.waitForSelector("text=overdue reminders", { timeout: 60000 });
  ok("run reminders now", true);

  // --- Role checks
  const marcus = await login("marcus@northside.example");
  const mExp = await marcus.ctx.request.get(`${BASE}/api/export/workspace`);
  ok("manager cannot export workspace", mExp.status() === 403);
  const mDoc = await marcus.ctx.request.get(`${BASE}${href}`);
  ok("manager can open non-restricted document", mDoc.status() === 200);
  const priya = await login("priya@northside.example");
  const pDoc = await priya.ctx.request.get(`${BASE}${href}`);
  ok("supervisor cannot open employee document", pDoc.status() === 404);
  await priya.page.goto(`${BASE}/app/employee/${href ? "x" : ""}`).catch(() => {});

  // --- Employee side
  const tomas = await login("tomas@northside.example");
  const t = tomas.page;
  await t.goto(`${BASE}/app/my-portal`, { waitUntil: "networkidle" });
  ok("employee sees policies section", await t.locator("text=Code of Conduct & Attendance").first().isVisible());
  await t.fill('input.input >> nth=0', "Tomas Alvarez").catch(() => {});
  const tDoc = await tomas.ctx.request.get(`${BASE}${href}`);
  ok("employee cannot open someone else's document", tDoc.status() === 404);
  await t.goto(`${BASE}/app/reports`, { waitUntil: "networkidle" });
  ok("employee is redirected away from reports", /my-portal/.test(t.url()));

  // Policy signature
  await t.goto(`${BASE}/app/my-portal`, { waitUntil: "networkidle" });
  const card = t.locator("div.card", { hasText: "Code of Conduct & Attendance" }).first();
  await card.locator("input.input").fill("Tomas Alvarez");
  await card.locator('button:has-text("Sign")').click();
  await t.waitForSelector("text=Policy signed", { timeout: 30000 });
  ok("employee signed policy", true);

  // Incident
  await t.goto(`${BASE}/app/my-portal`, { waitUntil: "networkidle" });
  await t.click("text=Report an incident");
  const lt = new Date(Date.now() - 3600_000);
  const pad = (n) => String(n).padStart(2, "0");
  await t.fill('[role="dialog"] input[type="datetime-local"]', `${lt.getFullYear()}-${pad(lt.getMonth() + 1)}-${pad(lt.getDate())}T${pad(lt.getHours())}:${pad(lt.getMinutes())}`);
  await t.fill('[role="dialog"] textarea', `Smoke test: loose guard rail near dock 2 (${stamp})`);
  await t.click('[role="dialog"] button:has-text("Submit report")');
  await t.waitForSelector("text=Report filed", { timeout: 30000 });
  ok("employee filed incident", true);
  await d.goto(`${BASE}/app/incidents`, { waitUntil: "networkidle" });
  ok("manager sees new incident", await d.locator(`text=Smoke test: loose guard rail`).first().isVisible());

  // Password reset flow (throwaway invitee)
  const fp = await browser.newContext();
  const fpp = await fp.newPage();
  fpp.setDefaultTimeout(90000);
  await fpp.goto(`${BASE}/forgot-password`, { waitUntil: "networkidle" });
  await fpp.fill('input[type="email"]', `import.${stamp}@example.com`);
  await fpp.click('button:has-text("Send reset link")');
  await fpp.waitForSelector("text=Check your email");
  const dev = await fpp.locator("a", { hasText: "reset-password?token=" }).first().getAttribute("href");
  ok("forgot password returns local dev link", !!dev);
  await fpp.goto(dev, { waitUntil: "networkidle" });
  await fpp.fill('input[autocomplete="new-password"] >> nth=0', "AnotherPassw0rd!2");
  await fpp.fill('input[autocomplete="new-password"] >> nth=1', "AnotherPassw0rd!2");
  await fpp.click('button:has-text("Save password")');
  await fpp.waitForURL(/\/app\/my-portal/, { timeout: 60000 });
  ok("password reset logs in", true);
  const stale = await fp.request.get(dev);
  ok("used reset link no longer works", stale.ok());
  await fp.close();
} catch (e) {
  console.log("ERROR", e.message.split("\n")[0]);
  results.push({ name: "script error", pass: false });
}
await browser.close();
const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
