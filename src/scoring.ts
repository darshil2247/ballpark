/**
 * Scoring — the heart of the game. Pure functions only, no DOM.
 * Every scoring decision lives here so it can be unit-tested in isolation.
 */

export const MAX_PER_QUESTION = 100;
export const ROUND_LEN = 5;
export const MAX_TOTAL = MAX_PER_QUESTION * ROUND_LEN; // 500

/** Range width in orders of magnitude. 0 = a point, 1 = a 10x range, 2 = 100x. */
export function widthOOM(loVal: number, hiVal: number): number {
  return Math.log10(hiVal / loVal);
}

/**
 * Points for one interval.
 * Inside the range: scales with tightness — a point-tight band ~100,
 * a 10x band 67, a 100x band 33, a >=1000x band 0.
 * Outside the range: 0. Never negative.
 */
export function points(loVal: number, hiVal: number, answer: number): number {
  if (!(loVal > 0) || !(hiVal >= loVal)) return 0;
  if (answer < loVal || answer > hiVal) return 0;
  const w = widthOOM(loVal, hiVal);
  return Math.round(MAX_PER_QUESTION * Math.max(0, 1 - w / 3));
}

export function isHit(loVal: number, hiVal: number, answer: number): boolean {
  return answer >= loVal && answer <= hiVal;
}

/** A human label for how tight a band is, by width in OOM. */
export function tightnessLabel(w: number): string {
  if (w < 0.35) return "razor-tight";
  if (w < 0.75) return "tight";
  if (w < 1.3) return "fair";
  if (w < 2) return "wide";
  return "very wide";
}

export interface Rank {
  name: string;
  message: string;
}

/** Rank from a 0–100 percentage of the max possible score. */
export function rankFor(pct: number): Rank {
  if (pct >= 92) return { name: "Oracle", message: "Razor-tight and right. You know what you don't know." };
  if (pct >= 80) return { name: "Forecaster", message: "Elite calibration — tight ranges, almost always right." };
  if (pct >= 64) return { name: "Sharp", message: "Strong instincts. You knew when to widen and when to commit." };
  if (pct >= 45) return { name: "Calibrated", message: "Solid. You're honest about uncertainty — keep tightening." };
  if (pct >= 22) return { name: "Warming up", message: "Getting there. Widen when you're unsure to protect the round." };
  return { name: "Rookie", message: "Rough round. A wider range that's right beats a tight one that's wrong." };
}

/** Convert a raw total (out of MAX_TOTAL) to a 0–100 percentage. */
export function pctOfTotal(total: number): number {
  return (total / MAX_TOTAL) * 100;
}
