// Page title and link-preview text come from the item being shown.
export default {
  eleventyComputed: {
    title: (data) => data.cs?.title,
    description: (data) => data.cs?.description || data.cs?.ask,
    shareImage: (data) => data.cs?.cover,
  },
};
