# Ballpark

A daily calibration game. Five "guess the number" questions a day — you drag a **range** onto a log scale instead of typing, and you score on whether the answer lands inside *and* how tight your range was. Tighter is riskier.

## Run it locally

```bash
npm install
npm run dev        # opens a local server — play it in your browser
```

## The commands

| command | what it does |
| --- | --- |
| `npm run dev` | local dev server with hot reload |
| `npm test` | runs the unit tests (scoring + validator) |
| `npm run check` | validates `content/questions.json` — **fails if any question is bad** |
| `npm run build` | typechecks, runs the build, outputs a single `dist/index.html` |

## How the code is organised

- `src/scoring.ts` — **all** scoring logic, pure functions, fully unit-tested (`scoring.test.ts`).
- `src/validate.ts` — the question schema validator, unit-tested (`validate.test.ts`).
- `src/interval.ts` — the drag-interval input. Self-contained and swappable.
- `src/daily.ts` — date selection + localStorage (streak, best, daily lock).
- `src/data.ts` — loads/validates the bank and picks today's puzzle (with fallback).
- `src/card.ts` — the shareable PNG result card.
- `src/game.ts` — screen flow and wiring (the orchestrator).
- `src/theme.css` — every design token in one place. Edit here to restyle everything.
- `content/questions.json` — the question bank (the only file you touch day to day).

## Adding questions

You don't add questions daily under pressure — you keep a **backlog** weeks ahead. Each question is dated; the game shows today's set automatically (no cron job).

Every question needs:

```json
{
  "id": "unique-slug",
  "date": "YYYY-MM-DD",
  "slot": 1,                 // 1..5, a day needs exactly 5
  "category": "Geography",
  "prompt": "How many ...?",
  "answer": 41000000,        // ABSOLUTE number
  "unit": "people",
  "minExp": 6,               // axis = 10^6 .. 10^9
  "maxExp": 9,
  "source": "https://...",   // REQUIRED — verify the number yourself
  "note": "One-line fact shown on reveal."
}
```

After editing, run `npm run check`. It fails the build if a question is missing a source, has an answer off its own axis (or too close to an edge), or leaves a day incomplete. That gate is what keeps the bank honest — **AI for ideas, you for verification.**

## Deploy

Push to GitHub, import the repo into Vercel or Netlify (framework preset: Vite, build `npm run build`, output `dist`). Every push redeploys. Add `npm run check` as a build step so a bad batch fails the deploy instead of shipping.

## Verify these seed answers

The seed bank is real but **spot-check these before launch**: Canada's population (~41M, drifts), and the Great Wall length (the ~21,196 km figure is the 2012 official survey including all branches). The `source` field on each links where to confirm.

## Deferred to v2

Crowd percentiles ("you beat 78%") and leaderboards need a backend (Supabase) to record guesses — build that only once the daily v1 is live and people are returning.
