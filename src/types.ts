export interface Question {
  id: string; // stable unique slug
  date: string; // "YYYY-MM-DD" — the day this question appears
  slot: number; // 1..5, position in that day's five
  category: string; // "Geography" | "Sport" | ...
  prompt: string; // the question text
  answer: number; // true value, ABSOLUTE (e.g. 41000000, not 41)
  unit: string; // "people", "meters", "keys"
  minExp: number; // axis lower bound = 10^minExp
  maxExp: number; // axis upper bound = 10^maxExp
  source: string; // REQUIRED — verifiable URL or citation
  note: string; // one-line reveal fact / "how to ballpark it"
}

export interface Puzzle {
  date: string;
  questions: Question[]; // exactly 5, sorted by slot
}

export interface Result {
  question: Question;
  loVal: number;
  hiVal: number;
  hit: boolean;
  points: number;
  widthOOM: number;
}
