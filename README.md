# freeformed.com

Erin Waddington's portfolio, hosted for free on Cloudflare.

The `site/` folder is the whole website: plain HTML plus the files it uses.
Cloudflare publishes whatever is in `site/` on the `main` branch.

## How the copy was made

`site/` is a static copy of the original Framer site, made by
`scripts/capture.mjs`. It keeps Framer's own HTML, CSS, fonts and scripts, so
the design and animations look the same, but nothing loads from Framer any more.
Files from Framer's CDN live under `site/_fc/`.

To make a fresh copy (only while the Framer site is still live), open
**Actions → Capture site from Framer → Run workflow**. It writes the copy to the
`capture` branch and before/after screenshots to the `capture-report` branch.

## Editing text later

Each page is one file: `site/index.html`, `site/about.html`,
`site/case-studies/stamps-com.html`, and so on. Find the sentence in the file
and change it. Commit to `main` and Cloudflare publishes it in about a minute.

## Cloudflare settings

The site runs as a Cloudflare Worker serving static files (`wrangler.jsonc`).

- Build command: (leave empty)
- Deploy command: `npx wrangler deploy`
- Preview command: `npx wrangler versions upload`
- Production branch: `main`
