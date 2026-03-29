import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { normalizeAll, normalizeAudio } from "../src/audio-processor.js";

function createSilentMp3(path: string, durationSec = 0.5): void {
  execFileSync("ffmpeg", [
    "-y",
    "-f",
    "lavfi",
    "-i",
    `anullsrc=r=24000:cl=mono`,
    "-t",
    String(durationSec),
    "-b:a",
    "192k",
    path,
  ]);
}

function ffmpegAvailable(): boolean {
  try {
    execFileSync("ffmpeg", ["-version"]);
    return true;
  } catch {
    return false;
  }
}

const describeWithFfmpeg = ffmpegAvailable() ? describe : describe.skip;

describeWithFfmpeg("audio-processor", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "audio-proc-test-"));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  describe("normalizeAudio", () => {
    it("normalizes a single audio file in-place", async () => {
      const mp3Path = join(tmpDir, "test.mp3");
      createSilentMp3(mp3Path);

      await normalizeAudio(mp3Path);

      const afterContent = await readFile(mp3Path);
      expect(afterContent.length).toBeGreaterThan(0);
    });
  });

  describe("normalizeAll", () => {
    it("normalizes multiple files", async () => {
      const paths = [join(tmpDir, "a.mp3"), join(tmpDir, "b.mp3")];
      createSilentMp3(paths[0]);
      createSilentMp3(paths[1]);

      await normalizeAll(paths);

      for (const p of paths) {
        const content = await readFile(p);
        expect(content.length).toBeGreaterThan(0);
      }
    });
  });
});
