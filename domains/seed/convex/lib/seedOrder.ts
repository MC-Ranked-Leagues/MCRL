import type { Doc } from "../_generated/dataModel";

export function compareSeedOrder(a: Doc<"seeds">, b: Doc<"seeds">) {
  if (a.seedNumber !== undefined && b.seedNumber !== undefined) {
    return a.seedNumber - b.seedNumber || a._creationTime - b._creationTime;
  }
  if (a.seedNumber !== undefined) return -1;
  if (b.seedNumber !== undefined) return 1;
  return a._creationTime - b._creationTime;
}
