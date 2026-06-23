import { describe, it, expect } from "vitest";
import { points, isHit, widthOOM, rankFor, tightnessLabel } from "./scoring";

describe("points", () => {
  it("near-point band containing the answer scores ~100", () => {
    expect(points(40, 42, 41)).toBeGreaterThanOrEqual(98);
  });

  it("a 10x band (W=1) containing the answer scores 67", () => {
    expect(points(10, 100, 50)).toBe(67);
  });

  it("a 100x band (W=2) containing the answer scores 33", () => {
    expect(points(10, 1000, 100)).toBe(33);
  });

  it("a band that misses scores 0", () => {
    expect(points(10, 20, 50)).toBe(0);
  });

  it("the answer exactly on a boundary counts as inside", () => {
    expect(points(10, 50, 50)).toBeGreaterThan(0);
    expect(points(10, 50, 10)).toBeGreaterThan(0);
  });

  it("a >=1000x band (W>=3) scores 0 even when it contains the answer", () => {
    expect(points(1, 10000, 100)).toBe(0);
  });

  it("rejects invalid bands", () => {
    expect(points(0, 100, 50)).toBe(0); // lo must be > 0
    expect(points(100, 10, 50)).toBe(0); // hi < lo
  });
});

describe("isHit", () => {
  it("is inclusive of both bounds", () => {
    expect(isHit(10, 20, 10)).toBe(true);
    expect(isHit(10, 20, 20)).toBe(true);
    expect(isHit(10, 20, 9.99)).toBe(false);
    expect(isHit(10, 20, 20.01)).toBe(false);
  });
});

describe("widthOOM", () => {
  it("measures orders of magnitude", () => {
    expect(widthOOM(10, 100)).toBeCloseTo(1);
    expect(widthOOM(1, 1000)).toBeCloseTo(3);
  });
});

describe("tightnessLabel", () => {
  it("buckets widths", () => {
    expect(tightnessLabel(0.1)).toBe("razor-tight");
    expect(tightnessLabel(0.5)).toBe("tight");
    expect(tightnessLabel(1.0)).toBe("fair");
    expect(tightnessLabel(1.6)).toBe("wide");
    expect(tightnessLabel(2.5)).toBe("very wide");
  });
});

describe("rankFor", () => {
  it("maps percentages to ranks at the thresholds", () => {
    expect(rankFor(95).name).toBe("Oracle");
    expect(rankFor(80).name).toBe("Forecaster");
    expect(rankFor(64).name).toBe("Sharp");
    expect(rankFor(45).name).toBe("Calibrated");
    expect(rankFor(22).name).toBe("Warming up");
    expect(rankFor(10).name).toBe("Rookie");
  });
});
