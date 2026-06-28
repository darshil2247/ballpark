import type { Puzzle, Result } from "./types";
import { getTodaysPuzzle } from "./data";
import { mountInterval, type IntervalInput } from "./interval";
import {
  points,
  isHit,
  widthOOM,
  tightnessLabel,
  rankFor,
  pctOfTotal,
  MAX_PER_QUESTION,
} from "./scoring";
import { fmt } from "./format";
import { loadSaved, hasPlayed, recordRound } from "./daily";
import { drawCard, copyCard, downloadCard } from "./card";

function niceRound(v: number): number {
  return Math.round(v);
}

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

// --- range readout helpers (editable numbers) ---
// Compact form for the resting display (matches the rest of the UI: 41M, 8,849).
function dispStr(v: number): string {
  return fmt(v);
}
// Full digits while editing, so the field is parseable/typeable.
function editStr(v: number): string {
  return String(Math.round(v));
}
// Size a mono input to its own content so the dash and unit sit flush like text.
function sizeInput(elm: HTMLInputElement): void {
  elm.style.width = (elm.value.length || 1) + 0.4 + "ch";
}
// Push the current interval into the inputs, never clobbering the one being typed in.
function syncRangeInputs(loVal: number, hiVal: number): void {
  const loIn = $("loIn") as HTMLInputElement;
  const hiIn = $("hiIn") as HTMLInputElement;
  if (document.activeElement !== loIn) {
    loIn.value = dispStr(loVal);
    sizeInput(loIn);
  }
  if (document.activeElement !== hiIn) {
    hiIn.value = dispStr(hiVal);
    sizeInput(hiIn);
  }
}

interface State {
  puzzle: Puzzle;
  idx: number;
  results: Result[];
  score: number;
  interval: IntervalInput | null;
  locked: boolean;
}

let S: State | null = null;

export function init(): void {
  const puzzle = getTodaysPuzzle();

  const saved = loadSaved();
  if (saved.bestScore > 0) {
    $("bestStrip").hidden = false;
    $("bestVal").textContent = String(saved.bestScore);
  }

  if (!puzzle) {
    $("startBtn").textContent = "No puzzle available";
    ($("startBtn") as HTMLButtonElement).disabled = true;
    return;
  }

  // Daily lock: if today's puzzle is already done, jump straight to the result.
  if (hasPlayed(puzzle.date)) {
    $("startBtn").textContent = "See today's result";
  }

  $("startBtn").addEventListener("click", () => start(puzzle));
  $("nextBtn").addEventListener("click", next);
  $("lockBtn").addEventListener("click", lock);
  $("copyBtn").addEventListener("click", onCopy);
  $("dlBtn").addEventListener("click", onDownload);
  wireRangeInputs();
}

// Attached once. Handlers read the live S.interval each time, so they keep
// working across questions even though a fresh interval is mounted per question.
function wireRangeInputs(): void {
  const loIn = $("loIn") as HTMLInputElement;
  const hiIn = $("hiIn") as HTMLInputElement;

  const onType = (which: "lo" | "hi", elm: HTMLInputElement) => {
    if (!S || S.locked || !S.interval) return;
    sizeInput(elm);
    const n = parseInt(elm.value.replace(/[^0-9]/g, ""), 10);
    if (Number.isNaN(n)) return;
    if (which === "lo") S.interval.setLow(n);
    else S.interval.setHigh(n);
  };

  const onFocus = (which: "lo" | "hi", elm: HTMLInputElement) => {
    if (!S || S.locked || !S.interval) return;
    const iv = S.interval.getInterval();
    elm.value = editStr(which === "lo" ? iv.loVal : iv.hiVal);
    sizeInput(elm);
    elm.select();
  };

  const onBlur = (which: "lo" | "hi", elm: HTMLInputElement) => {
    if (!S || !S.interval) return;
    const iv = S.interval.getInterval();
    elm.value = dispStr(which === "lo" ? iv.loVal : iv.hiVal);
    sizeInput(elm);
  };

  loIn.addEventListener("input", () => onType("lo", loIn));
  hiIn.addEventListener("input", () => onType("hi", hiIn));
  loIn.addEventListener("focus", () => onFocus("lo", loIn));
  hiIn.addEventListener("focus", () => onFocus("hi", hiIn));
  loIn.addEventListener("blur", () => onBlur("lo", loIn));
  hiIn.addEventListener("blur", () => onBlur("hi", hiIn));
  loIn.addEventListener("keydown", (e) => { if (e.key === "Enter") loIn.blur(); });
  hiIn.addEventListener("keydown", (e) => { if (e.key === "Enter") hiIn.blur(); });
}

function show(id: "start" | "play" | "results"): void {
  (["start", "play", "results"] as const).forEach((s) => ($(s).hidden = s !== id));
  window.scrollTo(0, 0);
}

function start(puzzle: Puzzle, force = false): void {
  if (!force && hasPlayed(puzzle.date)) {
    // already played today — show the stored result instead of replaying
    return showStoredResult(puzzle);
  }
  S = { puzzle, idx: 0, results: [], score: 0, interval: null, locked: false };
  show("play");
  renderQuestion();
}

function renderQuestion(): void {
  if (!S) return;
  const q = S.puzzle.questions[S.idx];
  S.locked = false;

  const saved = loadSaved();
  $("scoreChip").textContent = String(S.score);
  $("streakVal").textContent = String(saved.streak);
  $("streakChip").style.opacity = saved.streak > 0 ? "1" : "0.5";
  $("progFill").style.width = (S.idx / S.puzzle.questions.length) * 100 + "%";
  $("qcat").textContent = q.category;
  $("qprompt").textContent = q.prompt;
  $("reveal").hidden = true;
  $("lockBtn").hidden = false;
  $("stake").style.display = "";
  ($("lockBtn") as HTMLButtonElement).disabled = false;

  // editable readout: set the unit and re-enable the number fields
  $("unitLabel").textContent = q.unit;
  ($("loIn") as HTMLInputElement).disabled = false;
  ($("hiIn") as HTMLInputElement).disabled = false;

  S.interval?.destroy();
  S.interval = mountInterval($("nline"), { minExp: q.minExp, maxExp: q.maxExp });
  S.interval.onChange(() => {
    if (!S) return;
    const { loVal, hiVal } = S.interval!.getInterval();
    const w = widthOOM(loVal, hiVal);
    syncRangeInputs(loVal, hiVal);
    $("tightWord").textContent = tightnessLabel(w);
    const stake = Math.round(MAX_PER_QUESTION * Math.max(0, 1 - w / 3));
    $("stakePts").textContent = String(stake);
    $("stakePts").style.color = "var(--accent)";
  });
}

function lock(): void {
  if (!S || S.locked) return;
  S.locked = true;
  const q = S.puzzle.questions[S.idx];
  const raw = S.interval!.getInterval();
  const loVal = niceRound(raw.loVal);
  const hiVal = niceRound(raw.hiVal);
  const hit = isHit(loVal, hiVal, q.answer);
  const pts = points(loVal, hiVal, q.answer);
  const w = widthOOM(loVal, hiVal);
  S.results.push({ question: q, loVal, hiVal, hit, points: pts, widthOOM: w });
  S.score += pts;

  S.interval!.freeze(hit);
  S.interval!.showAnswer(q.answer);
  $("scoreChip").textContent = String(S.score);

  // lock the editable readout to the committed values
  const loIn = $("loIn") as HTMLInputElement;
  const hiIn = $("hiIn") as HTMLInputElement;
  loIn.value = dispStr(loVal);
  hiIn.value = dispStr(hiVal);
  sizeInput(loIn);
  sizeInput(hiIn);
  loIn.disabled = true;
  hiIn.disabled = true;

  const verdict = $("verdict");
  verdict.className = "verdict " + (hit ? "hit" : "miss");
  $("vtext").textContent = hit ? (w < 0.75 ? "Sharp — tight and right" : "Inside the range") : "Outside the range";
  $("vsub").textContent = hit ? `${tightnessLabel(w)} band` : "no points this time";
  const vp = $("vpts");
  vp.className = "vpts " + (hit ? "hit" : "miss");
  vp.textContent = (hit ? "+" : "") + pts;
  $("answerLine").innerHTML = `Answer: <b>${fmt(q.answer)} ${q.unit}</b>`;
  $("qnote").textContent = q.note;
  $("nextBtn").textContent = S.idx >= S.puzzle.questions.length - 1 ? "See results" : "Next";

  $("lockBtn").hidden = true;
  $("stake").style.display = "none";
  $("reveal").hidden = false;
}

function next(): void {
  if (!S) return;
  if (S.idx >= S.puzzle.questions.length - 1) return finish();
  S.idx++;
  renderQuestion();
}

function finish(): void {
  if (!S) return;
  recordRound(S.puzzle.date, S.results);
  renderResults(S.results, S.score, S.puzzle.date);
}

function renderResults(results: Result[], total: number, date: string): void {
  const saved = loadSaved();
  const rank = rankFor(pctOfTotal(total));
  $("finalScore").textContent = String(total);
  $("rankBadge").textContent = rank.name;
  $("resMsg").textContent = rank.message;
  show("results");
  void drawCard($("cardCanvas") as HTMLCanvasElement, { results, total, streak: saved.streak, date });
}

function showStoredResult(puzzle: Puzzle): void {
  const saved = loadSaved();
  const lr = saved.lastResult;
  if (!lr) return start(puzzle, true);
  // rebuild minimal results from the stored squares (enough for the card)
  const results = lr.squares.map((sq) => ({
    question: puzzle.questions[0],
    loVal: 0,
    hiVal: 0,
    hit: sq.hit,
    points: Math.round(MAX_PER_QUESTION * sq.tight),
    widthOOM: 3 * (1 - sq.tight),
  })) as Result[];
  renderResults(results, lr.score, lr.puzzleDate);
}

async function onCopy(): Promise<void> {
  const ok = await copyCard($("cardCanvas") as HTMLCanvasElement);
  toast(ok ? "Card copied — go ruin a group chat" : "Copy unsupported — use Download");
}
async function onDownload(): Promise<void> {
  await downloadCard($("cardCanvas") as HTMLCanvasElement, S ? S.score : 0);
  toast("Saved PNG");
}

let toastT: number | undefined;
function toast(msg: string): void {
  const t = $("toast");
  t.textContent = msg;
  clearTimeout(toastT);
  toastT = window.setTimeout(() => (t.textContent = ""), 2400);
}