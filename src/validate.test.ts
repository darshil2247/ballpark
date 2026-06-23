import { describe, it, expect } from "vitest";
import { validateQuestions } from "./validate";

function q(over: Record<string, unknown> = {}) {
  return {
    id: "x",
    date: "2026-06-20",
    slot: 1,
    category: "Test",
    prompt: "How many?",
    answer: 100,
    unit: "things",
    minExp: 1,
    maxExp: 4,
    source: "https://example.com",
    note: "A note.",
    ...over,
  };
}

// a complete valid day
function fullDay(date: string) {
  return [1, 2, 3, 4, 5].map((slot) => q({ id: `${date}-${slot}`, date, slot }));
}

describe("validateQuestions", () => {
  it("passes a complete, valid day", () => {
    expect(validateQuestions(fullDay("2026-06-20"))).toEqual([]);
  });

  it("rejects a missing source", () => {
    const day = fullDay("2026-06-20");
    (day[0] as any).source = "";
    expect(validateQuestions(day).some((e) => e.includes("source"))).toBe(true);
  });

  it("rejects an answer off its axis", () => {
    const day = fullDay("2026-06-20");
    (day[0] as any).answer = 1_000_000; // axis is 10^1..10^4
    expect(validateQuestions(day).some((e) => e.includes("off its axis"))).toBe(true);
  });

  it("rejects an answer too close to the axis edge", () => {
    const day = fullDay("2026-06-20");
    (day[0] as any).answer = 11; // ~2% of a 10^1..10^4 axis
    expect(validateQuestions(day).some((e) => e.includes("% of the axis"))).toBe(true);
  });

  it("rejects an incomplete day", () => {
    const day = fullDay("2026-06-20").slice(0, 4);
    expect(validateQuestions(day).some((e) => e.includes("missing slot 5"))).toBe(true);
  });

  it("rejects duplicate ids", () => {
    const day = fullDay("2026-06-20");
    (day[1] as any).id = (day[0] as any).id;
    expect(validateQuestions(day).some((e) => e.includes("duplicate id"))).toBe(true);
  });

  it("rejects minExp >= maxExp", () => {
    const day = fullDay("2026-06-20");
    (day[0] as any).minExp = 5;
    (day[0] as any).maxExp = 4;
    expect(validateQuestions(day).some((e) => e.includes("must be <"))).toBe(true);
  });
});
