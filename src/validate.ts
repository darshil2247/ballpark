import type { Question } from "./types";

/**
 * Validates a raw question bank against the data contract.
 * Returns a list of human-readable errors (empty = valid).
 * Used both at build time (npm run check) and at runtime (data.ts).
 */
export function validateQuestions(raw: unknown): string[] {
  const errors: string[] = [];
  if (!Array.isArray(raw)) return ["questions.json must be an array"];

  const ids = new Set<string>();
  const byDate = new Map<string, Set<number>>();

  raw.forEach((q, i) => {
    const where = `question[${i}]${q && (q as any).id ? ` "${(q as any).id}"` : ""}`;
    const e = (msg: string) => errors.push(`${where}: ${msg}`);

    if (typeof q !== "object" || q === null) {
      e("is not an object");
      return;
    }
    const x = q as Record<string, unknown>;

    const str = (k: string) => typeof x[k] === "string" && (x[k] as string).trim().length > 0;
    const num = (k: string) => typeof x[k] === "number" && Number.isFinite(x[k] as number);

    (["id", "date", "category", "prompt", "unit", "source", "note"] as const).forEach((k) => {
      if (!str(k)) e(`missing or empty string field "${k}"`);
    });
    (["slot", "answer", "minExp", "maxExp"] as const).forEach((k) => {
      if (!num(k)) e(`missing or non-numeric field "${k}"`);
    });
    if (errors.length && errors[errors.length - 1].startsWith(where)) {
      // if core fields are broken, skip the value-level checks for this item
    }

    if (str("id")) {
      const id = x.id as string;
      if (ids.has(id)) e(`duplicate id "${id}"`);
      ids.add(id);
    }

    if (num("slot")) {
      const slot = x.slot as number;
      if (!Number.isInteger(slot) || slot < 1 || slot > 5) e(`slot must be an integer 1..5 (got ${slot})`);
    }

    if (num("answer") && (x.answer as number) <= 0) e("answer must be > 0");

    if (num("minExp") && num("maxExp")) {
      const lo = x.minExp as number;
      const hi = x.maxExp as number;
      if (lo >= hi) e(`minExp (${lo}) must be < maxExp (${hi})`);
      if (num("answer")) {
        const a = x.answer as number;
        const aLo = Math.pow(10, lo);
        const aHi = Math.pow(10, hi);
        if (a < aLo || a > aHi) {
          e(`answer ${a} is off its axis [10^${lo}=${aLo}, 10^${hi}=${aHi}]`);
        } else {
          const pos = (Math.log10(a) - lo) / (hi - lo);
          if (pos < 0.12 || pos > 0.88) {
            e(`answer sits at ${(pos * 100).toFixed(0)}% of the axis — must be 12%–88% (widen or shift minExp/maxExp)`);
          }
        }
      }
    }

    if (str("date")) {
      const d = x.date as string;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || Number.isNaN(Date.parse(d))) {
        e(`date "${d}" is not a valid YYYY-MM-DD`);
      } else if (num("slot")) {
        if (!byDate.has(d)) byDate.set(d, new Set());
        const slots = byDate.get(d)!;
        const slot = x.slot as number;
        if (slots.has(slot)) e(`duplicate slot ${slot} on ${d}`);
        slots.add(slot);
      }
    }
  });

  // every dated puzzle must be complete: exactly slots 1..5
  byDate.forEach((slots, date) => {
    for (let s = 1; s <= 5; s++) {
      if (!slots.has(s)) errors.push(`puzzle ${date}: missing slot ${s} (a day needs exactly 5 questions)`);
    }
    if (slots.size > 5) errors.push(`puzzle ${date}: has more than 5 questions`);
  });

  return errors;
}

/** Throwing wrapper used where invalid data should be fatal. */
export function assertValid(raw: unknown): Question[] {
  const errors = validateQuestions(raw);
  if (errors.length) throw new Error("Invalid questions:\n" + errors.map((e) => "  - " + e).join("\n"));
  return raw as Question[];
}
