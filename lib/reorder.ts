// Drag-and-drop reorder helper (edit mode item list).
//
// Given the current flat, rank-ordered list of item ids and a drag that drops
// `from` just before/after the target `to`, compute the two neighbours `from`
// will end up between. Those ids feed the move endpoint, which assigns a
// fractional rank between them (empty string = the list edge / open end).
//
// Returns null when the move is a no-op or invalid (from === to, unknown target).
export function reorderNeighbours(
  from: string,
  to: string,
  pos: "before" | "after",
  ordered: string[],
): { afterId: string; beforeId: string } | null {
  if (from === to) return null;
  const ids = ordered.filter((x) => x !== from);
  const at = ids.indexOf(to);
  if (at < 0) return null;
  const insertAt = pos === "after" ? at + 1 : at;
  ids.splice(insertAt, 0, from);
  const p = ids.indexOf(from);
  const afterId = p > 0 ? ids[p - 1] : "";
  const beforeId = p < ids.length - 1 ? ids[p + 1] : "";
  // Dropping right next to where it already sits is a no-op — don't restage.
  const orig = ordered.indexOf(from);
  const origAfter = orig > 0 ? ordered[orig - 1] : "";
  const origBefore = orig < ordered.length - 1 ? ordered[orig + 1] : "";
  if (afterId === origAfter && beforeId === origBefore) return null;
  return { afterId, beforeId };
}
