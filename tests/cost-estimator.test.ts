import { describe, expect, it } from "vitest";
import type { Chunk } from "../src/types.js";
import { estimateCost, formatCostEstimate } from "../src/utils/cost-estimator.js";

function makeChunks(texts: string[]): Chunk[] {
  return texts.map((text, i) => ({ chapterIndex: 0, index: i, text }));
}

describe("estimateCost", () => {
  it("calculates total characters", () => {
    const chunks = makeChunks(["hello", "world"]);
    const estimate = estimateCost(chunks);
    expect(estimate.totalChars).toBe(10);
    expect(estimate.totalChunks).toBe(2);
  });

  it("estimates cost at $16/1M chars", () => {
    const text = "a".repeat(500_000);
    const estimate = estimateCost(makeChunks([text]));
    expect(estimate.estimatedCostUsd).toBeCloseTo(8.0);
  });

  it("marks within free tier for ≤1M chars", () => {
    const estimate = estimateCost(makeChunks(["hello"]));
    expect(estimate.withinFreeTier).toBe(true);
  });

  it("marks outside free tier for >1M chars", () => {
    const text = "a".repeat(1_000_001);
    const estimate = estimateCost(makeChunks([text]));
    expect(estimate.withinFreeTier).toBe(false);
  });

  it("handles empty chunks", () => {
    const estimate = estimateCost([]);
    expect(estimate.totalChars).toBe(0);
    expect(estimate.estimatedCostUsd).toBe(0);
    expect(estimate.withinFreeTier).toBe(true);
  });
});

describe("formatCostEstimate", () => {
  it("includes free tier note when applicable", () => {
    const estimate = estimateCost(makeChunks(["hello"]));
    const formatted = formatCostEstimate(estimate);
    expect(formatted).toContain("free tier");
  });

  it("does not include free tier note when over limit", () => {
    const text = "a".repeat(1_000_001);
    const estimate = estimateCost(makeChunks([text]));
    const formatted = formatCostEstimate(estimate);
    expect(formatted).not.toContain("free tier");
  });
});
