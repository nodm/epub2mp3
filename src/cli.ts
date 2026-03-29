#!/usr/bin/env node

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { Command } from "commander";
import "dotenv/config";
import { chunkBook } from "./chunker.js";
import { parseEpub } from "./epub-parser.js";
import { runPipeline } from "./pipeline.js";
import { cleanBook } from "./text-cleaner.js";
import type { Language } from "./types.js";
import { estimateCost, formatCostEstimate } from "./utils/cost-estimator.js";

const program = new Command();

program
  .name("epub2mp3")
  .description("Convert EPUB eBooks to MP3 audiobooks using Google Cloud TTS")
  .version("0.1.0")
  .argument("<input>", "Path to .epub file")
  .requiredOption("--lang <code>", "Language: en, uk, ru")
  .option("--voice <name>", "GCP voice name (default: auto for language)")
  .option("--output <path>", "Output file or directory")
  .option("--split-chapters", "One MP3 per chapter", false)
  .option("--crossfade", "Crossfade between segments", false)
  .option("--concurrency <n>", "Parallel TTS requests", Number, 3)
  .option("--chunk-size <n>", "Max chars per chunk", Number, 5000)
  .option("--dry-run", "Show cost estimate only", false)
  .action(async (input: string, options) => {
    try {
      await run(input, options);
    } catch (error) {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

type CliOptions = {
  lang: string;
  voice?: string;
  output?: string;
  splitChapters: boolean;
  crossfade: boolean;
  concurrency: number;
  chunkSize: number;
  dryRun: boolean;
};

async function run(input: string, options: CliOptions): Promise<void> {
  const inputPath = resolve(input);

  if (!existsSync(inputPath)) {
    throw new Error(`File not found: ${inputPath}`);
  }
  if (!inputPath.endsWith(".epub")) {
    throw new Error("Input must be an .epub file");
  }

  const validLangs = new Set(["en", "uk", "ru"]);
  if (!validLangs.has(options.lang)) {
    throw new Error(`Invalid language: ${options.lang}. Must be one of: en, uk, ru`);
  }

  if (options.splitChapters && options.output?.endsWith(".mp3")) {
    throw new Error("With --split-chapters, --output must be a directory, not a .mp3 file");
  }

  const lang = options.lang as Language;

  if (options.dryRun) {
    const book = cleanBook(parseEpub(inputPath));
    const chunks = chunkBook(book, options.chunkSize);
    const estimate = estimateCost(chunks);

    console.log(`\n${book.metadata.title} by ${book.metadata.author}\n`);
    console.log(formatCostEstimate(estimate));

    const chapterCount = new Set(chunks.map((c) => c.chapterIndex)).size;
    console.log(`Chapters:   ${chapterCount}`);
    return;
  }

  await runPipeline({
    inputPath,
    outputPath: options.output,
    lang,
    voice: options.voice,
    splitChapters: options.splitChapters,
    crossfade: options.crossfade,
    concurrency: options.concurrency,
    chunkSize: options.chunkSize,
  });
}

program.parse();
