import type { Result } from "./types";

const KEY = "ballpark.v1";

export interface Saved {
  lastPlayedDate: string | null; // puzzle date last completed
  streak: number;
  bestStreak: number;
  bestScore: number;
  lastResult: {
    puzzleDate: string;
    score: number;
    hits: number;
    squares: { hit: boolean; tight: number }[];
  } | null;
}

const EMPTY: Saved = {
  lastPlayedDate: null,
  streak: 0,
  bestStreak: 0,
  bestScore: 0,
  lastResult: null,
};

export function todayKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function loadSaved(): Saved {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...EMPTY };
    return { ...EMPTY, ...JSON.parse(raw) };
  } catch {
    return { ...EMPTY };
  }
}

function save(s: Saved): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* private mode / storage disabled — game still works, just no memory */
  }
}

/** Has the player already completed this exact puzzle? */
export function hasPlayed(puzzleDate: string): boolean {
  return loadSaved().lastResult?.puzzleDate === puzzleDate;
}

function dayDiff(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
}

/** Record a finished round; updates streak + bests. Returns the new saved state. */
export function recordRound(puzzleDate: string, results: Result[]): Saved {
  const s = loadSaved();
  const score = results.reduce((t, r) => t + r.points, 0);
  const hits = results.filter((r) => r.hit).length;

  if (s.lastPlayedDate && s.lastPlayedDate !== puzzleDate) {
    const gap = dayDiff(s.lastPlayedDate, puzzleDate);
    s.streak = gap === 1 ? s.streak + 1 : 1;
  } else if (!s.lastPlayedDate) {
    s.streak = 1;
  }
  s.bestStreak = Math.max(s.bestStreak, s.streak);
  s.bestScore = Math.max(s.bestScore, score);
  s.lastPlayedDate = puzzleDate;
  s.lastResult = {
    puzzleDate,
    score,
    hits,
    squares: results.map((r) => ({ hit: r.hit, tight: Math.max(0, 1 - r.widthOOM / 3) })),
  };
  save(s);
  return s;
}
