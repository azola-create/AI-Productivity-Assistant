/** Small, human-readable change summaries between two versions of AI output. */

const words = (v: string) => (v.trim() ? v.trim().split(/\s+/).length : 0);

export type Snapshot = Record<string, string | string[]>;

export function summariseChanges(before: Snapshot, after: Snapshot): string[] {
  const out: string[] = [];
  for (const key of Object.keys(after)) {
    const a = before[key];
    const b = after[key];
    if (a === undefined) continue;

    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) {
        out.push(`${key}: ${a.length} → ${b.length} items`);
      } else if (a.join("\u0000") !== b.join("\u0000")) {
        const changed = a.filter((x, i) => x !== b[i]).length;
        out.push(`${key}: ${changed} item${changed === 1 ? "" : "s"} rewritten`);
      }
      continue;
    }

    if (typeof a === "string" && typeof b === "string" && a !== b) {
      const delta = words(b) - words(a);
      out.push(
        `${key} rewritten${delta === 0 ? "" : ` (${delta > 0 ? "+" : ""}${delta} words)`}`,
      );
    }
  }
  return out.length ? out : ["No visible changes"];
}
