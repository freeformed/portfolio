// Page title and link-preview text come from the item being shown.
export default {
  eleventyComputed: {
    title: (data) => data.w?.title,
    description: (data) => data.w?.description || data.w?.intro,
  },
};
