// Serves ./site locally, opens every page next to the live site, and writes
// side-by-side screenshots plus a report of anything still loading from
// outside the copy (or failing) to ./report.
//
// Usage: node scripts/verify.mjs [origin]   (default https://www.freeformed.com)

import { chromium } from "playwright";
import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { sliceRanges } from "../src/framercms.js";

const ORIGIN = (process.argv[2] || "https://www.freeformed.com").replace(/\/$/, "");
const SITE = path.resolve("site");
const REPORT = path.resolve("report");
const PORT = 8788;

const TYPES = {
  ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif", ".avif": "image/avif",
  ".woff2": "font/woff2", ".woff": "font/woff", ".ttf": "font/ttf", ".mp4": "video/mp4",
  ".webm": "video/webm", ".pdf": "application/pdf",
};

// Mirrors how Cloudflare Pages resolves /about to about.html.
async function resolve(p) {
  const candidates = p.endsWith("/") ? [p + "index.html"] : [p, p + ".html", p + "/index.html"];
  for (const c of candidates) {
    const f = path.join(SITE, decodeURIComponent(c));
    try {
      if ((await fs.stat(f)).isFile()) return f;
    } catch {}
  }
  return null;
}

const server = http.createServer(async (req, res) => {
  const p = req.url.split("?")[0];
  const f = await resolve(p);
  if (!f) {
    res.writeHead(404, { "content-type": "text/html" });
    return res.end(await fs.readFile(path.join(SITE, "404.html")).catch(() => "not found"));
  }
  let body = await fs.readFile(f);
  // Same byte-range handling as src/worker.js.
  const range = new URL(req.url, "http://x").searchParams.get("range");
  if (range && f.endsWith(".framercms")) body = Buffer.from(sliceRanges(body, range));
  res.writeHead(200, { "content-type": TYPES[path.extname(f).toLowerCase()] || "application/octet-stream" });
  res.end(body);
});

async function shoot(page, url, file) {
  await page.goto(url, { waitUntil: "load", timeout: 30000 }).catch(() => {});
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 400) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 120));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(1000);
  await page.screenshot({ path: file, fullPage: true, type: "jpeg", quality: 60 });
}

async function main() {
  await new Promise((r) => server.listen(PORT, r));
  await fs.rm(REPORT, { recursive: true, force: true });
  await fs.mkdir(REPORT, { recursive: true });

  const routes = [];
  for await (const f of fs.glob("**/*.html", { cwd: SITE })) {
    if (f.startsWith("_")) continue;
    routes.push(f === "index.html" ? "/" : "/" + f.replace(/\.html$/, ""));
  }
  routes.sort();

  const browser = await chromium.launch();
  const lines = [];
  for (const [label, width, height] of [["desktop", 1440, 900], ["mobile", 390, 844]]) {
    const ctx = await browser.newContext({ viewport: { width, height } });
    const page = await ctx.newPage();
    let current = "";
    const problems = new Map();
    const note = (msg) => {
      if (!problems.has(current)) problems.set(current, new Set());
      problems.get(current).add(msg);
    };
    page.on("request", (r) => {
      const u = new URL(r.url());
      // Google Analytics is Erin's own tracking and stays.
      if (/google(tagmanager|-analytics)\.com$/.test(u.hostname)) return;
      if (current && u.hostname !== "localhost" && !u.protocol.startsWith("data")) note(`external: ${r.url()}`);
    });
    page.on("response", (r) => {
      if (current && r.status() >= 400 && r.url().includes("localhost")) note(`${r.status()}: ${r.url()}`);
    });
    page.on("pageerror", (e) => current && note(`js error: ${e.message}`));

    for (const route of routes) {
      const name = (route === "/" ? "home" : route.slice(1).replace(/\//g, "__")) + `.${label}`;
      current = "";
      if (label === "desktop" || route.split("/").length <= 2) {
        await shoot(page, ORIGIN + route, path.join(REPORT, `${name}.live.jpg`));
      }
      current = route;
      await shoot(page, `http://localhost:${PORT}${route}`, path.join(REPORT, `${name}.copy.jpg`));
      current = "";
    }
    lines.push(`## ${label}`);
    if (!problems.size) lines.push("No external requests, broken files or script errors.");
    for (const [route, msgs] of problems) {
      lines.push(`### ${route}`);
      for (const m of msgs) lines.push(`- ${m}`);
    }
    await ctx.close();
  }
  await browser.close();
  server.close();

  const report = `# Capture check\n\nPages: ${routes.length}\n\n${lines.join("\n")}\n`;
  await fs.writeFile(path.join(REPORT, "README.md"), report);
  console.log(report);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
