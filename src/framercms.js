// Framer's CMS reads its data files in pieces, asking for byte ranges in the
// query string (?range=0-99,200-299) and expecting just those bytes back,
// joined together. Static hosting ignores query strings, so we slice here.
export function sliceRanges(bytes, range) {
  const parts = range.split(",").map((r) => r.split("-").map(Number));
  const total = parts.reduce((n, [from, to]) => n + (to - from + 1), 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const [from, to] of parts) {
    out.set(bytes.subarray(from, to + 1), at);
    at += to - from + 1;
  }
  return out;
}
