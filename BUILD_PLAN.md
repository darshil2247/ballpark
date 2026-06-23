# Build Plan — Ballpark (daily calibration game)

*A spec to hand to Claude Code, built one phase at a time. Keep this file in the repo root as `BUILD_PLAN.md` and work down it. The name "Ballpark" is a placeholder — swap it for whatever you land on (your friend's "Intervals" works too).*

---

## 0. What you're building

A daily web game. Five "guess the number" questions a day, played once per day (Wordle cadence — **not** a grindy high-score arcade). For each question you don't type a number: you **drag an interval** onto a fixed log scale, and you're scored on whether the true answer falls inside *and* how tight your range was. Tighter is riskier. At the end you get a calibration **rank** (Rookie → Oracle) and a shareable **PNG card**.

No accounts, no server in v1. It's a well-structured static site plus a curated, version-controlled question bank.

---

## 1. Stack & principles

- **Vite + TypeScript**, vanilla (no React needed). TypeScript is non-negotiable — it kills the class of bugs that make vibe-coded games break.
- **Vitest** for unit tests.
- **No framework, no UI library.** Plain modules and DOM.
- **Three rules that keep it from being a blob:**
  1. The scoring lives in one pure, tested module. No scoring logic anywhere else.
  2. Questions are *data* with a schema and a validator. A bad question fails the build — it can't ship.
  3. The input (drag interval) is its own isolated module, swappable without touching scoring or game state.
- **Build it phase by phase** (Section 5). One module per Claude Code instruction, reviewed and understood before the next. This is also how you avoid the 32k-token error from before.

---

## 2. Repo structure

```
ballpark/
├─ index.html              # minimal Vite entry shell
├─ package.json
├─ tsconfig.json
├─ vite.config.ts
├─ src/
│  ├─ main.ts              # bootstraps app, mounts the game
│  ├─ types.ts            # Question, Puzzle, Result, GameState
│  ├─ scoring.ts          # PURE: width, points, hit-test, rank
│  ├─ scoring.test.ts
│  ├─ validate.ts         # question schema validator (shared by build + runtime)
│  ├─ validate.test.ts
│  ├─ data.ts             # load today's puzzle, validate, graceful fallback
│  ├─ daily.ts            # date → puzzle selection; localStorage lock + streak
│  ├─ interval.ts         # the drag-interval input on the log axis (isolated)
│  ├─ game.ts             # state machine: start → question → reveal → results
│  ├─ card.ts             # canvas → shareable PNG
│  ├─ theme.css           # design tokens in ONE place (swap to restyle)
│  └─ ui.ts               # small render helpers per screen
├─ content/
│  └─ questions.json      # the curated bank — dated, sourced
├─ scripts/
│  └─ check-questions.ts  # `npm run check` — fails build on any bad question
└─ BUILD_PLAN.md          # this file
```

Each file stays small. If `game.ts` starts ballooning, that's the signal to move logic into a pure module.

---

## 3. The data contract (the anti-slop core)

Every question is one object in `content/questions.json`:

```ts
type Question = {
  id: string;        // stable unique slug, e.g. "canada-population-2025"
  date: string;      // "YYYY-MM-DD" — the day this question appears
  slot: number;      // 1..5, its position in that day's five
  category: string;  // "Geography" | "Sport" | "Science" | ...
  prompt: string;    // the question text
  answer: number;    // the true value, ABSOLUTE (e.g. 41000000, not 41)
  unit: string;      // "people", "meters", "keys"
  minExp: number;    // axis lower bound = 10^minExp
  maxExp: number;    // axis upper bound = 10^maxExp
  source: string;    // REQUIRED — a verifiable URL or citation. No source, no ship.
  note: string;      // one-line "how to ballpark it" / fun fact, shown on reveal
};
```

**`validate.ts` must reject (and `npm run check` must fail the build) if any of these are true:**

- A required field is missing or the wrong type.
- `answer <= 0`, or `minExp >= maxExp`.
- The answer is off its own axis: not `10^minExp <= answer <= 10^maxExp`.
- The answer sits too close to an edge — its log position must fall within **0.12–0.88** of the span (so it's locatable but not clipped or given away). Fail, or at least warn loudly.
- `source` is empty or whitespace.
- Duplicate `id`s anywhere.
- Any date that has questions does **not** have exactly 5 unique slots (1–5). A day must be complete.
- `date` doesn't parse as a real calendar date.

This validator is the technical guard behind "no AI slop": a question with no source, or a wrong-magnitude answer, physically cannot reach players.

---

## 4. The scoring contract

All in `scoring.ts`, pure functions only:

```
widthOOM(loVal, hiVal)        = log10(hiVal / loVal)          // range width in orders of magnitude

points(loVal, hiVal, answer):
    if answer < loVal or answer > hiVal:  return 0            // missed
    W = widthOOM(loVal, hiVal)
    return round(100 * max(0, 1 - W / 3))                     // tighter = more; W>=3 → 0

rankFor(total):  // total is out of 500 (5 × 100); convert to /100 first if you prefer
    Oracle      >= 92
    Forecaster  >= 80
    Sharp       >= 64
    Calibrated  >= 45
    Warming up  >= 22
    Rookie       < 22
```

Keep scoring **positive-only** (a miss is 0, never negative) — that's the friendly feel you wanted, and it fits the calibration framing better than streak-punishment.

**Required tests in `scoring.test.ts`:**

- Tiny band containing the answer → ~100.
- 10× band (`W=1`) containing → 67.
- 100× band (`W=2`) containing → 33.
- Band not containing the answer → 0.
- Answer exactly on a boundary → counts as inside.
- Very wide band (`W >= 3`) even if containing → 0.
- Each rank threshold returns the right rank.

Write these tests in the same phase as the scoring. If they're green, the heart of the game is correct.

---

## 5. Build phases — paste one at a time into Claude Code

Do these in order. After each, run it, read the code, and confirm the "verify" line before moving on.

### Phase 0 — Scaffold
```
Create a Vite + TypeScript project for a static web game called "Ballpark".
No framework. Add Vitest for unit tests. Set up the exact folder structure in
section 2 of BUILD_PLAN.md with empty placeholder files. Add npm scripts: "dev",
"build", "test", and "check" (check runs scripts/check-questions.ts). Make a
minimal index.html that loads src/main.ts and renders "Ballpark" so I can confirm
dev mode works. Stop there — don't implement game logic yet.
```
*Verify: `npm run dev` shows the page; `npm test` runs (0 tests is fine).*

### Phase 1 — Scoring (heart first, tested)
```
Implement src/types.ts and src/scoring.ts exactly per sections 3 and 4 of
BUILD_PLAN.md — pure functions only, no DOM. Then write src/scoring.test.ts
covering every case listed in section 4. Make all tests pass. Show me the test
output.
```
*Verify: `npm test` is green and the cases match section 4.*

### Phase 2 — Question schema + validator + seed content
```
Implement src/validate.ts as a function validateQuestions(questions) that enforces
every rule in section 3 of BUILD_PLAN.md and returns a list of errors. Write
src/validate.test.ts with a few valid and several deliberately-broken questions.
Then create content/questions.json seeded with TWO complete daily puzzles (10
questions total), each question fully filled in WITH a real source URL — flag in a
comment any answer you're not 100% sure of so I can verify it. Finally wire
scripts/check-questions.ts so `npm run check` validates content/questions.json and
exits non-zero on any error.
```
*Verify: `npm run check` passes on good content and fails if you delete a `source`.*

### Phase 3 — Daily selection + persistence
```
Implement src/daily.ts: todayKey() returning local "YYYY-MM-DD"; functions to read
the played-today lock, streak, best score, and last-played date from localStorage
(namespaced keys). Implement src/data.ts: load content/questions.json, run
validate.ts, select today's 5 questions by date sorted by slot, and on any
failure (no puzzle for today, or validation errors) fall back gracefully to the
most recent valid complete puzzle and log a clear warning. Return a typed Puzzle.
No UI yet.
```
*Verify: a small console test prints today's 5 (or the fallback) in slot order.*

### Phase 4 — The drag-interval input (isolated)
```
Implement src/interval.ts as a self-contained module for the input. It mounts into
a container given {minExp, maxExp}, draws a log axis with decade tick labels, and
lets the user set an interval by dragging TWO handles (low and high) and dragging
the band itself to reposition. Use pointer events with touch-action:none so it
works on mobile. Expose: getInterval() → {loVal, hiVal}, onChange(cb), freeze(),
and showAnswer(value, hit) which drops a marker and colors the band. Keep it
framework-free and independent of scoring/game so I could swap the input later.
Give me a tiny standalone demo page to feel it.
```
*Verify: you can drag it smoothly on your phone; values read out correctly.*

### Phase 5 — Wire the daily game loop
```
Implement src/game.ts and src/ui.ts and src/theme.css to assemble the playable
daily loop using the existing modules: a start screen, then 5 questions each using
interval.ts for input with a live "points at stake" readout (from scoring.ts),
a reveal per question (answer marker + score + note), and a results screen showing
total, rank (scoring.rankFor), hit rate, and streak. Enforce the daily lock from
daily.ts: if already played today, show the results state instead of replaying.
All design tokens live in theme.css as CSS variables. Build it screen by screen
and let me review each before the next.
```
*Verify: full loop plays; refreshing after finishing shows the locked result.*

### Phase 6 — Share card
```
Implement src/card.ts: render a shareable PNG on a canvas — title, date, big score,
rank badge, five result squares (✓/✕, darker = tighter), hit rate, streak, and a
tagline. Add Download PNG and Copy-image-to-clipboard buttons on the results
screen, with a graceful fallback message if clipboard image write isn't supported.
```
*Verify: the card downloads and looks good when pasted into a chat / on mobile.*

### Phase 7 — Polish & ship
```
Add: graceful empty/error states (never a blank screen), keyboard focus styles,
prefers-reduced-motion handling, a privacy-friendly analytics snippet placeholder,
and a README explaining how to add questions and deploy. Then help me initialise
git, commit, and push to a new GitHub repo.
```
*Verify: `npm run build` succeeds; the repo is on GitHub.*

---

## 6. Adding questions — your weekly curation workflow

You don't add questions *daily under pressure*. You curate a **backlog** in batches; the `date` field schedules them and the client picks today's set automatically. No cron job.

Each curation session:
1. Brainstorm candidates (AI is fine *for ideas only*).
2. For each, find and paste a **real source URL** and verify the number yourself. No source → it doesn't go in.
3. Aim for surprising / debate-worthy numbers, not dry trivia.
4. Set `minExp`/`maxExp` so the answer sits comfortably mid-axis (the validator enforces 0.12–0.88).
5. Assign a `date` and `slot` 1–5; keep each day complete (exactly 5).
6. Run `npm run check`. If it's green, commit and push — that's your approval gate and it auto-deploys.

Target staying **2–8 weeks ahead** so you're never scrambling. When typing into JSON gets tedious, move the bank to Airtable (form entry + draft/verified/scheduled status) and have `data.ts` fetch it at runtime instead — the rest of the code doesn't change.

---

## 7. Deploy

GitHub repo → Vercel (or Netlify): import the repo, framework preset "Vite", build command `npm run build`, output `dist`. Every push redeploys. Add `npm run check` as a step so a bad question batch fails the deploy instead of shipping. Buy a real domain when you're ready — it's the cheapest credibility you can buy.

---

## 8. Deliberately deferred to v2

- **Crowd percentiles / "you beat 78% of players"** and any real leaderboard. These need a backend to record guesses — that's where **Supabase** (Postgres + an API) comes in, and it can also hold the question bank at that point. Build it only once the daily v1 is live and you've confirmed people come back.
- Accounts, themed packs, the confidence-slider alternative input, a gentle timer. All swappable later precisely because the modules are isolated.

Build v1 first. It's a static site, a tested scoring module, and a sourced backlog — genuinely shippable without any of the above.
