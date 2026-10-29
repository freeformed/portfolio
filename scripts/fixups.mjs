// Small patches to Framer's runtime so the copy works off Framer's servers.
// They run on already-rewritten files, so they can be re-applied to site/ at
// any time: node scripts/fixups.mjs

import fs from "node:fs/promises";
import path from "node:path";

const HIDE_FORMS = "<style data-no-forms>form{display:none!important}</style>";

export function fixup(text) {
  return (
    text
      // new URL("./x", "/_fc/...") needs an absolute base; CDN URLs used to be one.
      .replace(/(new URL\([^,()]+,)(["'`])(\/_(?:fc|gfonts|gcss)\/)/g, "$1location.origin+$2$3")
      // Material icons load from framer.com/m/material-icons/<Name>.js@<version>.
      .replaceAll("https://framer.com/m/material-icons/", "/_framer/m/material-icons/")
      .replace(/\}\.js@[\d.]+`/g, "}.js`")
      // Erin dropped the contact form (it only drew spam); the email link stays.
      // Hidden rather than deleted so Framer's scripts still match the page.
      .replace(/(<\/head>)/, (head) => (text.includes("<form") && !text.includes(HIDE_FORMS) ? HIDE_FORMS + head : head))
      // Footer year, which Framer had baked into every page.
      .replaceAll("© 2025 Erin Waddington", "© 2026 Erin Waddington")
      // Framer's on-page editor bar only makes sense on Framer hosting.
      .replace(/EditorBar:([\w$]+)===void 0\?void 0:/g, "EditorBar:void 0,_editorBar:")
  );
}

async function main() {
  const root = path.resolve("site");
  let changed = 0;
  for await (const f of fs.glob("**/*.{html,mjs,js,json}", { cwd: root })) {
    const file = path.join(root, f);
    const before = await fs.readFile(file, "utf8");
    const after = fixup(before);
    if (after !== before) {
      await fs.writeFile(file, after);
      changed++;
    }
  }
  console.log(`patched ${changed} files`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
