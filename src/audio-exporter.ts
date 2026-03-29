import { mkdir, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { execa } from "execa";
import NodeID3 from "node-id3";
import type { BookMetadata, SynthesizedChunk } from "./types.js";

export type ExportConfig = {
  metadata: BookMetadata;
  splitChapters: boolean;
  outputPath: string;
};

export async function exportAudio(
  synthesized: SynthesizedChunk[],
  config: ExportConfig,
): Promise<string[]> {
  if (synthesized.length === 0) return [];

  if (config.splitChapters) {
    return exportPerChapter(synthesized, config);
  }
  return [await exportSingleFile(synthesized, config)];
}

async function exportSingleFile(
  synthesized: SynthesizedChunk[],
  config: ExportConfig,
): Promise<string> {
  const outputPath = config.outputPath.endsWith(".mp3")
    ? config.outputPath
    : `${config.outputPath}.mp3`;

  await mkdir(dirname(outputPath), { recursive: true });

  const sorted = [...synthesized].sort((a, b) => a.chunk.index - b.chunk.index);
  await concatMp3(
    sorted.map((s) => s.audioPath),
    outputPath,
  );
  await writeId3Tags(outputPath, config.metadata);

  return outputPath;
}

async function exportPerChapter(
  synthesized: SynthesizedChunk[],
  config: ExportConfig,
): Promise<string[]> {
  const outputDir = config.outputPath;
  await mkdir(outputDir, { recursive: true });

  const chapters = new Map<number, SynthesizedChunk[]>();
  for (const item of synthesized) {
    const group = chapters.get(item.chunk.chapterIndex) ?? [];
    group.push(item);
    chapters.set(item.chunk.chapterIndex, group);
  }

  const titleSlug = slugify(config.metadata.title);
  const outputPaths: string[] = [];

  for (const [chapterIndex, items] of [...chapters.entries()].sort((a, b) => a[0] - b[0])) {
    const sorted = items.sort((a, b) => a.chunk.index - b.chunk.index);
    const chapterNum = String(chapterIndex + 1).padStart(2, "0");
    const outputPath = join(outputDir, `Chapter_${chapterNum}_${titleSlug}.mp3`);

    await concatMp3(
      sorted.map((s) => s.audioPath),
      outputPath,
    );

    const chapterTitle = items[0]?.chunk.chapterTitle;
    await writeId3Tags(outputPath, config.metadata, chapterTitle);
    outputPaths.push(outputPath);
  }

  return outputPaths;
}

async function concatMp3(inputPaths: string[], outputPath: string): Promise<void> {
  if (inputPaths.length === 1) {
    await execa("ffmpeg", ["-y", "-i", inputPaths[0], "-c", "copy", outputPath]);
    return;
  }

  const listPath = `${outputPath}.list.txt`;
  const listContent = inputPaths.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join("\n");
  await writeFile(listPath, listContent);

  await execa("ffmpeg", [
    "-y",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    listPath,
    "-c",
    "copy",
    outputPath,
  ]);
  await unlink(listPath).catch(() => {});
}

function writeId3Tags(filePath: string, metadata: BookMetadata, chapterTitle?: string): void {
  const tags: NodeID3.Tags = {
    title: chapterTitle ?? metadata.title,
    artist: metadata.author,
    language: metadata.language,
  };

  const result = NodeID3.update(tags, filePath);
  if (result instanceof Error) {
    throw result;
  }
}

export function slugify(text: string): string {
  return text
    .replace(/\s+/g, "_")
    .replace(/[^\p{L}\p{N}_-]/gu, "")
    .slice(0, 100);
}
