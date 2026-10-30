# freeformed.com

Erin Waddington's portfolio, hosted for free on Cloudflare.

## Editing the site

Use [Pages CMS](https://app.pagescms.org): sign in with GitHub and open
`freeformed/portfolio`. Every save is a commit to GitHub, and Cloudflare
publishes it about a minute later.

- **Case studies** and **More work**: one entry per project. "Position in the
  list" sets the order; "Show on the home page" picks the case studies on the
  home page. A new entry's file name becomes its address, e.g.
  `/case-studies/stamps-com`.
- **Home page**, **About page**, **Contact page**, **Other page text**: the
  words on those pages.
- **Site settings**: name, menu, footer, email, LinkedIn/Behance links, link
  preview image and Google Analytics.
- Images and videos go in the media library (the `media/` folder). Images are
  shown at half their pixel size, so export them at 2x. In "More work" content,
  a Vimeo or YouTube link on a line of its own becomes a video player.

## How it's built

[Eleventy](https://www.11ty.dev) turns the content into plain HTML.

- `content/`: everything editable (Markdown and JSON). `.pages.yml` describes
  it to Pages CMS.
- `media/`: images, videos and the CV.
- `src/`: page templates (`*.njk`), styles (`css/site.css`), the small script
  for the phone menu and testimonial slider (`js/site.js`), and fonts.

To work on it locally: `npm install`, then `npm start` and open
http://localhost:8080. `npm run build` writes the finished site to `_site/`.

## Cloudflare settings

The site is a Cloudflare Worker that only serves static files
(`wrangler.jsonc`). `npx wrangler deploy` runs `npm run build` first (the
`build` setting in `wrangler.jsonc`) and uploads `_site/`, so the Workers Builds
settings stay as they are:

- Build command: (leave empty)
- Deploy command: `npx wrangler deploy`
- Preview command: `npx wrangler versions upload`
- Production branch: `main`
