import rawQuestions from "../content/questions.json";
import type { Puzzle, Question } from "./types";
import { validateQuestions } from "./validate";
import { todayKey } from "./daily";

/**
 * Loads the bank, validates it, and groups it into complete daily puzzles.
 * A runtime validation failure is logged but never blanks the screen — we
 * fall back to whatever complete puzzles we do have.
 */
function loadPuzzles(): Map<string, Puzzle> {
  const errors = validateQuestions(rawQuestions);
  if (errors.length) {
    console.warn("questions.json has validation problems (run `npm run check`):\n" + errors.join("\n"));
  }

  const byDate = new Map<string, Question[]>();
  for (const q of rawQuestions as Question[]) {
    if (!byDate.has(q.date)) byDate.set(q.date, []);
    byDate.get(q.date)!.push(q);
  }

  const puzzles = new Map<string, Puzzle>();
  for (const [date, qs] of byDate) {
    if (qs.length !== 5) continue; // only ship complete days
    const sorted = [...qs].sort((a, b) => a.slot - b.slot);
    puzzles.set(date, { date, questions: sorted });
  }
  return puzzles;
}

const PUZZLES = loadPuzzles();

/**
 * Today's puzzle if one exists; otherwise the most recent past puzzle;
 * otherwise the most recent puzzle overall. Returns null only if the bank
 * is completely empty.
 */
export function getTodaysPuzzle(today = todayKey()): Puzzle | null {
  if (PUZZLES.has(today)) return PUZZLES.get(today)!;
  const dates = [...PUZZLES.keys()].sort();
  if (dates.length === 0) return null;
  const past = dates.filter((d) => d <= today);
  const pick = past.length ? past[past.length - 1] : dates[dates.length - 1];
  return PUZZLES.get(pick)!;
}
