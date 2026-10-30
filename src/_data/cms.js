// Loads everything editable from content/ for the templates.
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import markdownIt from "markdown-it";
import { imageSize } from "image-size";

const CONTENT = path.resolve("content");
const md = markdownIt({ html: true, linkify: true });

const json = (name) => JSON.parse(fs.readFileSync(path.join(CONTENT, name), "utf8"));

function collection(dir) {
  const folder = path.join(CONTENT, dir);
  return fs
    .readdirSync(folder)
    .filter((f) => f.endsWith(".md"))
    .map((f) => {
      const { data, content } = matter(fs.readFileSync(path.join(folder, f), "utf8"));
      return { ...data, slug: f.replace(/\.md$/, ""), body: content };
    })
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999) || a.title.localeCompare(b.title));
}

// A line holding only a Vimeo or YouTube link becomes an embedded player.
function embed(url) {
  let m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (m) return `https://player.vimeo.com/video/${m[1]}`;
  m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{6,})/);
  if (m) return `https://www.youtube-nocookie.com/embed/${m[1]}`;
  return null;
}

// Images show at half their pixel size (they're exported at 2x), never wider
// than the column. Images 2048px or larger simply fill the column.
function imageWidth(src) {
  try {
    const { width, height } = imageSize(fs.readFileSync(path.resolve(src.replace(/^\//, ""))));
    if (Math.max(width, height) >= 2048) return { width, height };
    return { width: Math.round(width / 2), height: Math.round(height / 2) };
  } catch {
    return null;
  }
}

function richText(body) {
  let html = md.render(body || "");
  html = html.replace(/<p>\s*(?:<a [^>]*>)?\s*(https?:\/\/[^\s<]+)\s*(?:<\/a>)?\s*<\/p>/g, (all, url) => {
    const src = embed(url);
    return src ? `<div class="embed"><iframe src="${src}" title="Video" loading="lazy" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe></div>` : all;
  });
  html = html.replace(/<img ([^>]*?)src="(\/media\/[^"]+)"([^>]*)>/g, (all, before, src, after) => {
    if (/\swidth=/.test(before + after)) return all;
    const size = imageWidth(src);
    const dims = size ? ` width="${size.width}" height="${size.height}"` : "";
    return `<img ${before}src="${src}"${dims} loading="lazy"${after}>`;
  });
  // An image on its own line shouldn't sit inside a paragraph.
  html = html.replace(/<p>\s*(<img [^>]+>)\s*<\/p>/g, "$1");
  return html;
}

export default function () {
  const caseStudies = collection("case-studies");
  for (const [i, c] of caseStudies.entries()) {
    // "next" may hold a slug or a file path, depending on how it was picked.
    const next = String(c.next || "").split("/").pop().replace(/\.md$/, "");
    c.next = caseStudies.find((o) => o.slug === next && o !== c) || caseStudies[(i + 1) % caseStudies.length];
  }
  const moreWork = collection("more-work").map((w) => ({ ...w, html: richText(w.body) }));
  return {
    site: json("site.json"),
    home: json("home.json"),
    about: json("about.json"),
    contact: json("contact.json"),
    pages: json("pages.json"),
    caseStudies,
    moreWork,
  };
}
