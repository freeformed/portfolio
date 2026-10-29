// Captures the live Framer site as a self-contained static copy in ./site.
//
// Every page's server HTML is saved as-is, every file it needs from Framer's
// CDN (scripts, styles, fonts, images, videos, PDFs) is downloaded, and the
// absolute CDN URLs are rewritten to local paths so nothing loads from Framer.
//
// Usage: node scripts/capture.mjs [origin]   (default https://www.freeformed.com)

import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
import { fixup } from "./fixups.mjs";

const ORIGIN = (process.argv[2] || "https://www.freeformed.com").replace(/\/$/, "");
const OUT = path.resolve("site");

// Remote hosts we copy, and the local folder each one is served from.
const HOSTS = {
  "framerusercontent.com": "/_fc",
  "fonts.gstatic.com": "/_gfonts",
  "fonts.googleapis.com": "/_gcss",
};
// Framer's icon modules, saved under the same tree as their framer.com URL.
const ICON_PREFIX = "https://framer.com/m/material-icons/";
const SITE_HOSTS = new Set(["freeformed.com", "www.freeformed.com"]);

const SEEDS = [
  "/", "/case-studies", "/more-work", "/about", "/contact", "/404",
];

const pages = new Map(); // route -> html
const assets = new Map(); // url (no query) -> Buffer
const queue = [...SEEDS];
const seen = new Set();
const tried = new Set(); // asset urls already requested, including failures

const hostRe = Object.keys(HOSTS).map((h) => h.replace(/\./g, "\\.")).join("|");
const assetUrlRe = new RegExp(`https?:\\/\\/(?:${hostRe})\\/[^"'\\s)\\\\<>\`]+`, "g");

function stripQuery(u) {
  return u.replace(/&amp;/g, "&").split(/[?#]/)[0];
}

function localPath(u) {
  const url = new URL(stripQuery(u));
  if (url.href.startsWith(ICON_PREFIX)) return "/_framer" + url.pathname;
  return HOSTS[url.hostname] + url.pathname;
}

function routeFile(route) {
  if (route === "/") return "index.html";
  if (route === "/404") return "404.html";
  return route.replace(/^\//, "") + ".html";
}

async function fetchAsset(u) {
  const key = stripQuery(u);
  if (assets.has(key) || tried.has(key)) return;
  tried.add(key);
  assets.set(key, null);
  try {
    const res = await fetch(key, { headers: { "user-agent": "Mozilla/5.0 site-capture" } });
    if (!res.ok) {
      console.warn(`  ! ${res.status} ${key}`);
      assets.delete(key);
      return;
    }
    assets.set(key, Buffer.from(await res.arrayBuffer()));
  } catch (e) {
    console.warn(`  ! ${e.message} ${key}`);
    assets.delete(key);
  }
}

function isText(key) {
  return /\.(m?js|css|json|svg|html?|txt)$/i.test(key) || key.includes("fonts.googleapis.com");
}

// Relative module imports inside Framer's JS chunks ("./chunk-ABC.mjs").
function relativeImports(key, text) {
  const out = [];
  for (const m of text.matchAll(/["'`](\.\.?\/[^"'`\s]+?\.m?js)["'`]/g)) {
    out.push(new URL(m[1], key).href);
  }
  // CMS data files: new URL("./x.framercms", "https://framerusercontent.com/modules/...")
  // resolves under /cms/ instead of /modules/.
  for (const m of text.matchAll(/new URL\(`\.\/([^`]+\.framercms)`,`(https:\/\/framerusercontent\.com\/[^`]+)`\)/g)) {
    out.push(new URL(m[1], m[2]).href.replace("/modules/", "/cms/"));
  }
  return out;
}

function rewrite(text) {
  // Keep any query string: static hosting ignores it, and Framer's runtime
  // sometimes appends its own resize params to image URLs.
  let t = text.replace(assetUrlRe, (u) => u.replace(/^https?:\/\/([^/]+)/, (_, h) => HOSTS[h]));
  // Links to the site itself become root-relative so preview URLs work too.
  t = t.replace(/https?:\/\/(?:www\.)?freeformed\.com(?=[\/"'?#])/g, "");
  t = t.replace(/(href|content)="(?=["#?])/g, '$1="/');
  return fixup(t);
}

function cleanHtml(html) {
  return html
    // Framer analytics and the "Made in Framer" badge.
    .replace(/<script[^>]*events\.framer\.com[^>]*><\/script>/g, "")
    .replace(/<div id="__framer-badge-container"[\s\S]*?<\/div>\s*(?=<)/g, "")
    .replace(/<meta name="generator" content="Framer[^"]*">/g, "");
}

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const icons = new Set();
  page.on("request", (req) => {
    const u = req.url();
    if (u.startsWith(ICON_PREFIX)) icons.add(u.split("@")[0].replace(/\.js$/, "") + ".js|" + u);
  });

  page.on("response", async (res) => {
    try {
      const u = new URL(res.url());
      // CMS files are requested in byte ranges; those get fetched whole later.
      if (u.pathname.endsWith(".framercms")) return;
      if (HOSTS[u.hostname] && res.request().method() === "GET" && res.status() === 200) {
        const key = stripQuery(res.url());
        if (!assets.get(key)) assets.set(key, await res.body());
      }
    } catch {}
  });

  while (queue.length) {
    const route = queue.shift();
    if (seen.has(route)) continue;
    seen.add(route);
    console.log(`page ${route}`);

    const res = await fetch(ORIGIN + route, { headers: { "user-agent": "Mozilla/5.0 site-capture" } });
    if (!res.ok && route !== "/404") {
      console.warn(`  ! ${res.status}`);
      continue;
    }
    pages.set(route, await res.text());

    // Load it in a real browser so lazily loaded chunks, fonts and media show up.
    await page.goto(ORIGIN + route, { waitUntil: "load", timeout: 30000 }).catch(() => {});
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 400) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 120));
      }
    });
    await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});

    for (const href of await page.$$eval("a[href]", (as) => as.map((a) => a.href))) {
      try {
        const u = new URL(href);
        if (SITE_HOSTS.has(u.hostname)) {
          const r = u.pathname.replace(/\/$/, "") || "/";
          if (!seen.has(r)) queue.push(r);
        }
      } catch {}
    }
  }
  await browser.close();

  // Icon modules redirect to framerusercontent.com; save the module at a .js path.
  for (const entry of icons) {
    const [key, u] = entry.split("|");
    const res = await fetch(u).catch(() => null);
    if (res?.ok) assets.set(key, Buffer.from(await res.arrayBuffer()));
    else console.warn(`  ! icon ${u}`);
  }

  // Pull in every CDN file referenced from pages, CSS and JS until nothing new turns up.
  let pending = [
    ...pages.values(),
    ...[...assets].filter(([k, b]) => b && isText(k)).map(([, b]) => b.toString("utf8")),
  ];
  for (;;) {
    const found = new Set();
    for (const text of pending) for (const m of text.matchAll(assetUrlRe)) found.add(stripQuery(m[0]));
    for (const [key, buf] of assets) {
      if (buf && isText(key) && /\.m?js$/.test(key)) {
        for (const u of relativeImports(key, buf.toString("utf8"))) found.add(u);
      }
    }
    const fresh = [...found].filter((u) => !assets.has(u) && !tried.has(u));
    if (!fresh.length) break;
    console.log(`fetching ${fresh.length} assets`);
    for (let i = 0; i < fresh.length; i += 8) await Promise.all(fresh.slice(i, i + 8).map(fetchAsset));
    pending = fresh.filter((k) => assets.get(k) && isText(k)).map((k) => assets.get(k).toString("utf8"));
  }

  await fs.rm(OUT, { recursive: true, force: true });
  for (const [route, html] of pages) {
    const file = path.join(OUT, routeFile(route));
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, rewrite(cleanHtml(html)));
  }
  for (const [key, buf] of assets) {
    if (!buf) continue;
    const file = path.join(OUT, localPath(key));
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, isText(key) ? rewrite(buf.toString("utf8")) : buf);
  }
  console.log(`saved ${pages.size} pages and ${[...assets.values()].filter(Boolean).length} assets to ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
