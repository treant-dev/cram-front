// Tint of an item row. In VIEW mode items are never tinted — the live page stays
// clean; draft status colors show ONLY in edit mode. This is why a just-published
// change must go back to neutral: publishing exits edit mode.
export type ItemTint = "neutral" | "added" | "changed" | "deleted";

export function itemTint(
  editMode: boolean,
  status: "added" | "changed" | undefined,
  deleted: boolean,
): ItemTint {
  if (!editMode) return "neutral";
  if (deleted) return "deleted";
  return status ?? "neutral";
}
