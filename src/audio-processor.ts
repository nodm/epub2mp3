import { rename, unlink } from "node:fs/promises";
import { execa } from "execa";

const LOUDNORM_FILTER = "loudnorm=I=-16:TP=-1.5:LRA=11";
const CROSSFADE_MS = 50;

export async function normalizeAudio(inputPath: string): Promise<void> {
  const tmpPath = `${inputPath}.norm.mp3`;

  await execa("ffmpeg", [
    "-y",
    "-i",
    inputPath,
    "-af",
    LOUDNORM_FILTER,
    "-ar",
    "24000",
    "-b:a",
    "192k",
    tmpPath,
  ]);

  await unlink(inputPath);
  await rename(tmpPath, inputPath);
}

export async function normalizeAll(paths: string[]): Promise<void> {
  for (const path of paths) {
    await normalizeAudio(path);
  }
}

export async function crossfadeSegments(inputPaths: string[], outputPath: string): Promise<void> {
  if (inputPaths.length === 0) return;
  if (inputPaths.length === 1) {
    await rename(inputPaths[0], outputPath);
    return;
  }

  // Build ffmpeg filter chain for crossfade
  // acrossfade between pairs of inputs sequentially
  const inputs: string[] = [];
  for (const p of inputPaths) {
    inputs.push("-i", p);
  }

  const filters: string[] = [];
  const n = inputPaths.length;

  // Chain crossfades: [0][1] -> [cf1], [cf1][2] -> [cf2], etc.
  filters.push(`[0][1]acrossfade=d=${CROSSFADE_MS / 1000}:c1=tri:c2=tri[cf1]`);
  for (let i = 2; i < n; i++) {
    const prev = `cf${i - 1}`;
    const next = `cf${i}`;
    filters.push(`[${prev}][${i}]acrossfade=d=${CROSSFADE_MS / 1000}:c1=tri:c2=tri[${next}]`);
  }

  const lastLabel = `cf${n - 1}`;

  await execa("ffmpeg", [
    "-y",
    ...inputs,
    "-filter_complex",
    filters.join(";"),
    "-map",
    `[${lastLabel}]`,
    "-b:a",
    "192k",
    outputPath,
  ]);
}
