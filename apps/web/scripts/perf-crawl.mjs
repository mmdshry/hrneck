/**
 * Local network crawl: login as platform admin, enter itneck, visit org pages,
 * report duplicate GETs per page. Run: node scripts/perf-crawl.mjs
 */
import { chromium } from "@playwright/test";

const BASE = process.env.PERF_BASE_URL ?? "http://hrneck.test";
const EMAIL = process.env.PERF_EMAIL ?? "admin@hrneck.test";
const PASSWORD = process.env.PERF_PASSWORD ?? "DemoPass!234";
const TENANT = process.env.PERF_TENANT ?? "itneck";

const PAGES = [
  "/msp",
  `/org?tenant=${TENANT}`,
  `/org/users?tenant=${TENANT}`,
  `/org/targets?tenant=${TENANT}`,
  `/org/groups?tenant=${TENANT}`,
  `/org/departments?tenant=${TENANT}`,
  `/org/campaigns?tenant=${TENANT}`,
  `/org/training?tenant=${TENANT}`,
  `/org/training/campaigns?tenant=${TENANT}`,
  `/org/courses?tenant=${TENANT}`,
  `/org/checklists?tenant=${TENANT}`,
  `/org/checklists/packs?tenant=${TENANT}`,
  `/org/checklists/instances?tenant=${TENANT}`,
  `/org/ticketing?tenant=${TENANT}`,
  `/org/ticketing/desks?tenant=${TENANT}`,
  `/org/ticketing/kb?tenant=${TENANT}`,
  `/org/ticketing/email?tenant=${TENANT}`,
  `/org/ticketing/search?tenant=${TENANT}`,
  `/org/ticketing/reports?tenant=${TENANT}`,
  `/org/reports?tenant=${TENANT}`,
  `/org/reports/export?tenant=${TENANT}`,
  `/org/announcements?tenant=${TENANT}`,
  `/org/notifications?tenant=${TENANT}`,
  `/org/settings/mfa?tenant=${TENANT}`,
  `/learn?tenant=${TENANT}`,
  `/portal?tenant=${TENANT}`,
  `/portal/tickets?tenant=${TENANT}`,
  `/portal/kb?tenant=${TENANT}`,
];

function normalizeUrl(url) {
  try {
    const u = new URL(url);
    u.searchParams.delete("_");
    return `${u.pathname}${u.search}`;
  } catch {
    return url;
  }
}

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: /continue/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 20_000 });
}

async function enterTenant(page) {
  if (!page.url().includes("/msp")) {
    await page.goto(`${BASE}/msp`, { waitUntil: "domcontentloaded" });
  }
  await page.getByRole("textbox", { name: /filter name/i }).fill("ITneck");
  await page.getByRole("button", { name: /open tenant admin/i }).first().click();
  await page.waitForURL((url) => url.pathname.startsWith("/org"), { timeout: 20_000 });
}

async function crawlPage(page, path) {
  const requests = [];
  const onReq = (req) => {
    const url = req.url();
    if (!url.includes("/api/") && !url.includes("/sanctum/") && !url.includes("/broadcasting/")) {
      return;
    }
    requests.push({ method: req.method(), url: normalizeUrl(url) });
  };
  page.on("request", onReq);
  try {
    await page.goto(`${BASE}${path}`, { waitUntil: "networkidle", timeout: 45_000 });
    await page.waitForTimeout(2500);
  } catch (err) {
    return { path, error: String(err), duplicates: [], apiCalls: 0 };
  } finally {
    page.off("request", onReq);
  }

  const gets = requests.filter((r) => r.method === "GET").map((r) => r.url);
  const counts = new Map();
  for (const g of gets) {
    counts.set(g, (counts.get(g) ?? 0) + 1);
  }
  const duplicates = [...counts.entries()]
    .filter(([, n]) => n > 1)
    .map(([url, n]) => ({ url, n }))
    .sort((a, b) => b.n - a.n);

  return {
    path,
    apiCalls: requests.length,
    getCalls: gets.length,
    duplicates,
    top: [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8),
  };
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();

const report = { email: EMAIL, tenant: TENANT, pages: [] };

try {
  await login(page);
  if (EMAIL.includes("hrneck.test")) {
    await enterTenant(page);
  }
  for (const path of PAGES) {
    if (path === "/msp" && !EMAIL.includes("hrneck.test")) continue;
    const row = await crawlPage(page, path);
    report.pages.push(row);
    const dup = row.duplicates?.length ?? 0;
    console.log(
      `${path} api=${row.apiCalls ?? 0} gets=${row.getCalls ?? 0} dupes=${dup}${row.error ? ` ERR ${row.error}` : ""}`,
    );
  }
} finally {
  await browser.close();
}

const flagged = report.pages.filter((p) => (p.duplicates?.length ?? 0) > 0);
console.log("\n=== DUPLICATE GET SUMMARY ===");
for (const p of flagged) {
  console.log(`\n${p.path}`);
  for (const d of p.duplicates) {
    console.log(`  ${d.n}x ${d.url}`);
  }
}

import { writeFileSync } from "node:fs";
writeFileSync("scripts/perf-crawl-report.json", JSON.stringify(report, null, 2));
console.log(`\nWrote scripts/perf-crawl-report.json (${flagged.length} pages with duplicate GETs)`);
