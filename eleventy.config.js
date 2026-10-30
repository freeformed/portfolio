// Builds the site from the files in content/ (edited with Pages CMS) into _site/.
export default function (config) {
  config.addPassthroughCopy({ media: "media", "src/fonts": "fonts", "src/css": "css", "src/js": "js", "src/icons": "icons", "src/_headers": "_headers", "src/_redirects": "_redirects" });
  config.setNunjucksEnvironmentOptions({ autoescape: true });
  config.addWatchTarget("content/");
  config.addWatchTarget("media/");

  // Absolute URL for link previews (og:image and friends).
  config.addFilter("absolute", (path, base) => (path && path.startsWith("/") ? base.replace(/\/$/, "") + path : path));

  // "/about.html" -> "/about", "/index.html" -> "/". Pages are written as .html
  // files so the addresses match the old site.
  config.addFilter("clean", (url) => url.replace(/(index)?\.html$/, ""));

  return {
    dir: { input: "src", output: "_site" },
    templateFormats: ["njk"],
    htmlTemplateEngine: "njk",
  };
}
