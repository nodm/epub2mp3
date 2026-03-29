import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const FIXTURE_PATH = join(__dirname, "fixtures", "sample.epub");

describe("cli", () => {
  it("shows help", () => {
    const output = execFileSync("node", ["--import", "tsx", "src/cli.ts", "--help"], {
      encoding: "utf-8",
      cwd: join(__dirname, ".."),
    });
    expect(output).toContain("epub2mp3");
    expect(output).toContain("--lang");
    expect(output).toContain("--split-chapters");
    expect(output).toContain("--dry-run");
  });

  it("runs dry-run on sample epub", () => {
    const output = execFileSync(
      "node",
      ["--import", "tsx", "src/cli.ts", FIXTURE_PATH, "--lang", "uk", "--dry-run"],
      { encoding: "utf-8", cwd: join(__dirname, "..") },
    );
    expect(output).toContain("Тестовая книга");
    expect(output).toContain("Characters:");
    expect(output).toContain("Chunks:");
  });

  it("rejects invalid language", () => {
    try {
      execFileSync(
        "node",
        ["--import", "tsx", "src/cli.ts", FIXTURE_PATH, "--lang", "xx", "--dry-run"],
        { encoding: "utf-8", cwd: join(__dirname, ".."), stdio: "pipe" },
      );
      expect.fail("should have thrown");
    } catch (error: unknown) {
      const stderr = (error as { stderr?: string }).stderr ?? "";
      expect(stderr).toContain("Invalid language");
    }
  });

  it("rejects non-epub file", () => {
    try {
      execFileSync(
        "node",
        ["--import", "tsx", "src/cli.ts", "package.json", "--lang", "en", "--dry-run"],
        { encoding: "utf-8", cwd: join(__dirname, ".."), stdio: "pipe" },
      );
      expect.fail("should have thrown");
    } catch (error: unknown) {
      const stderr = (error as { stderr?: string }).stderr ?? "";
      expect(stderr).toContain(".epub");
    }
  });
});
