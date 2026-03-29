import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { exportAudio, slugify } from "./audio-exporter.js";
import { normalizeAll } from "./audio-processor.js";
import { chunkBook } from "./chunker.js";
import { parseEpub } from "./epub-parser.js";
import { cleanBook } from "./text-cleaner.js";
import { synthesizeChunks } from "./tts-engine.js";
import type { PipelineConfig } from "./types.js";
import { estimateCost, formatCostEstimate } from "./utils/cost-estimator.js";

export type PipelineResult = {
  outputPaths: string[];
  totalChars: number;
  totalChunks: number;
};

export async function runPipeline(
  config: PipelineConfig,
  log: (msg: string) => void = console.log,
): Promise<PipelineResult> {
  const start = performance.now();

  // Stage 1: Parse EPUB
  log("Parsing EPUB...");
  const rawBook = parseEpub(config.inputPath);
  log(`  Title: ${rawBook.metadata.title}`);
  log(`  Author: ${rawBook.metadata.author}`);
  log(`  Blocks: ${rawBook.blocks.length}`);

  // Stage 2: Clean text
  log("Cleaning text...");
  const book = cleanBook(rawBook);
  log(`  Blocks after cleaning: ${book.blocks.length}`);

  // Stage 3: Chunk
  log("Chunking text...");
  const chunks = chunkBook(book, config.chunkSize);
  log(`  Chunks: ${chunks.length}`);

  // Cost estimate
  const estimate = estimateCost(chunks);
  log(`\n${formatCostEstimate(estimate)}\n`);

  if (chunks.length === 0) {
    log("No text to synthesize.");
    return { outputPaths: [], totalChars: 0, totalChunks: 0 };
  }

  // Stage 4: TTS synthesis
  log("Synthesizing audio...");
  const tmpDir = join(tmpdir(), `epub2mp3-${Date.now()}`);
  await mkdir(tmpDir, { recursive: true });

  try {
    const synthesized = await synthesizeChunks(chunks, {
      lang: config.lang,
      voice: config.voice,
      concurrency: config.concurrency,
      outputDir: tmpDir,
      onProgress: (completed, total) => {
        log(`  [${completed}/${total}] chunks synthesized`);
      },
    });

    // Stage 5: Normalize audio
    log("Normalizing audio...");
    await normalizeAll(synthesized.map((s) => s.audioPath));

    // Stage 6: Export
    log("Exporting MP3...");
    const outputPath =
      config.outputPath ?? deriveOutputPath(rawBook.metadata.title, config.splitChapters);

    const outputPaths = await exportAudio(synthesized, {
      metadata: rawBook.metadata,
      splitChapters: config.splitChapters,
      outputPath,
    });

    const elapsed = ((performance.now() - start) / 1000).toFixed(1);
    log(`\nDone in ${elapsed}s`);
    for (const p of outputPaths) {
      log(`  → ${p}`);
    }

    return {
      outputPaths,
      totalChars: estimate.totalChars,
      totalChunks: estimate.totalChunks,
    };
  } finally {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

function deriveOutputPath(title: string, splitChapters: boolean): string {
  const slug = slugify(title) || "audiobook";
  return splitChapters ? slug : `${slug}.mp3`;
}
