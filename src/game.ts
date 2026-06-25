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

  S.interval?.destroy();
  S.interval = mountInterval($("nline"), { minExp: q.minExp, maxExp: q.maxExp });
  S.interval.onChange(() => {
    if (!S) return;
    const { loVal, hiVal } = S.interval!.getInterval();
    const w = widthOOM(loVal, hiVal);
    $("rangeRead").textContent = `${fmt(loVal)} – ${fmt(hiVal)} ${q.unit}`;
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
