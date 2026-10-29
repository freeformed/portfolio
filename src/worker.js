// Serves the static site from site/. Only the contact form and Framer CMS data
// requests reach this code (see run_worker_first in wrangler.jsonc); everything
// else is served straight from the static files.
import { handleContact } from "./contact.js";
import { sliceRanges } from "./framercms.js";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/contact") return handleContact(request, env);
    const range = url.searchParams.get("range");
    const res = await env.ASSETS.fetch(request);
    if (!range || !res.ok || !/^[\d,-]+$/.test(range)) return res;
    const bytes = new Uint8Array(await res.arrayBuffer());
    return new Response(sliceRanges(bytes, range), {
      headers: {
        "content-type": "application/octet-stream",
        "cache-control": "public, max-age=3600",
      },
    });
  },
};
