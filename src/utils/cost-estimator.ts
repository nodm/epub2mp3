import type { Chunk } from "../types.js";

const WAVENET_PRICE_PER_MILLION = 16; // $16 per 1M chars
const FREE_TIER_CHARS = 1_000_000; // 1M WaveNet chars/month

export type CostEstimate = {
  totalChars: number;
  totalChunks: number;
  estimatedCostUsd: number;
  withinFreeTier: boolean;
};

export function estimateCost(chunks: Chunk[]): CostEstimate {
  const totalChars = chunks.reduce((sum, c) => sum + c.text.length, 0);
  const estimatedCostUsd = (totalChars / 1_000_000) * WAVENET_PRICE_PER_MILLION;

  return {
    totalChars,
    totalChunks: chunks.length,
    estimatedCostUsd,
    withinFreeTier: totalChars <= FREE_TIER_CHARS,
  };
}

export function formatCostEstimate(estimate: CostEstimate): string {
  const lines = [
    `Characters: ${estimate.totalChars.toLocaleString()}`,
    `Chunks:     ${estimate.totalChunks}`,
    `Est. cost:  $${estimate.estimatedCostUsd.toFixed(2)}`,
  ];

  if (estimate.withinFreeTier) {
    lines.push("(within GCP free tier — $0.00 actual)");
  }

  return lines.join("\n");
}
