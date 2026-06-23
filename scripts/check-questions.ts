import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { validateQuestions } from "../src/validate";

const here = dirname(fileURLToPath(import.meta.url));
const file = resolve(here, "../content/questions.json");

let raw: unknown;
try {
  raw = JSON.parse(readFileSync(file, "utf8"));
} catch (err) {
  console.error("Could not read/parse content/questions.json:", (err as Error).message);
  process.exit(1);
}

const errors = validateQuestions(raw);
if (errors.length) {
  console.error(`\n✗ ${errors.length} problem(s) in content/questions.json:\n`);
  errors.forEach((e) => console.error("  - " + e));
  console.error("");
  process.exit(1);
}

const days = new Set((raw as { date: string }[]).map((q) => q.date));
console.log(`✓ questions.json is valid — ${(raw as unknown[]).length} questions across ${days.size} day(s).`);
