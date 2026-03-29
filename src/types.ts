export type Language = "en" | "uk" | "ru";

export type BookMetadata = {
  title: string;
  author: string;
  language: Language;
};

export type TextBlock = {
  chapterIndex: number;
  chapterTitle?: string;
  text: string;
};

export type ParsedBook = {
  metadata: BookMetadata;
  blocks: TextBlock[];
};

export type Chunk = {
  chapterIndex: number;
  chapterTitle?: string;
  index: number;
  text: string;
};

export type SynthesizedChunk = {
  chunk: Chunk;
  audioPath: string;
};

export type PipelineConfig = {
  inputPath: string;
  outputPath?: string;
  lang: Language;
  voice?: string;
  splitChapters: boolean;
  crossfade: boolean;
  concurrency: number;
  chunkSize: number;
};
