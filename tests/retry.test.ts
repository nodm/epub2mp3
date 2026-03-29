import { describe, expect, it, vi } from "vitest";
import { withRetry } from "../src/utils/retry.js";

describe("withRetry", () => {
  it("returns result on first success", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const result = await withRetry(fn, { maxRetries: 3, baseDelayMs: 10 });

    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries on retryable error and succeeds", async () => {
    const fn = vi.fn().mockRejectedValueOnce(new Error("429 rate limit")).mockResolvedValue("ok");

    const result = await withRetry(fn, { maxRetries: 3, baseDelayMs: 10 });

    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("throws immediately on non-retryable error", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("401 unauthorized"));

    await expect(withRetry(fn, { maxRetries: 3, baseDelayMs: 10 })).rejects.toThrow(
      "401 unauthorized",
    );
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("throws after max retries exhausted", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("503 service unavailable"));

    await expect(withRetry(fn, { maxRetries: 2, baseDelayMs: 10 })).rejects.toThrow(
      "503 service unavailable",
    );
    expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it("retries on 500 errors", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("500 internal server error"))
      .mockResolvedValue("ok");

    const result = await withRetry(fn, { maxRetries: 2, baseDelayMs: 10 });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("retries on connection reset", async () => {
    const fn = vi.fn().mockRejectedValueOnce(new Error("ECONNRESET")).mockResolvedValue("ok");

    const result = await withRetry(fn, { maxRetries: 2, baseDelayMs: 10 });
    expect(result).toBe("ok");
  });

  it("retries on timeout", async () => {
    const fn = vi.fn().mockRejectedValueOnce(new Error("request timeout")).mockResolvedValue("ok");

    const result = await withRetry(fn, { maxRetries: 2, baseDelayMs: 10 });
    expect(result).toBe("ok");
  });
});
