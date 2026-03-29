import type { Chunk, Language, ParsedBook } from "./types.js";

const DEFAULT_MAX_CHARS = 5000;

export function chunkBook(book: ParsedBook, maxChars = DEFAULT_MAX_CHARS): Chunk[] {
  const chunks: Chunk[] = [];
  let globalIndex = 0;

  const grouped = groupByChapter(book);

  for (const [chapterIndex, group] of grouped.entries()) {
    const chapterText = group.blocks.map((b) => b.text).join("\n");
    const sentences = splitSentences(chapterText, book.metadata.language);
    const chapterChunks = accumulate(sentences, maxChars);

    for (const text of chapterChunks) {
      chunks.push({
        chapterIndex,
        chapterTitle: group.chapterTitle,
        index: globalIndex++,
        text,
      });
    }
  }

  return chunks;
}

type ChapterGroup = {
  chapterTitle?: string;
  blocks: { text: string }[];
};

function groupByChapter(book: ParsedBook): ChapterGroup[] {
  const groups: ChapterGroup[] = [];

  for (const block of book.blocks) {
    const existing = groups[block.chapterIndex];
    if (existing) {
      existing.blocks.push(block);
    } else {
      groups[block.chapterIndex] = {
        chapterTitle: block.chapterTitle,
        blocks: [block],
      };
    }
  }

  return groups.filter(Boolean);
}

export function splitSentences(text: string, lang: Language): string[] {
  const segmenter = new Intl.Segmenter(lang, { granularity: "sentence" });
  const sentences: string[] = [];

  for (const { segment } of segmenter.segment(text)) {
    const trimmed = segment.trim();
    if (trimmed) sentences.push(trimmed);
  }

  return sentences;
}

function accumulate(sentences: string[], maxChars: number): string[] {
  const chunks: string[] = [];
  let buffer = "";

  for (const sentence of sentences) {
    if (sentence.length > maxChars) {
      if (buffer) {
        chunks.push(buffer);
        buffer = "";
      }
      for (const fragment of splitLongSentence(sentence, maxChars)) {
        chunks.push(fragment);
      }
      continue;
    }

    const separator = buffer ? " " : "";
    if (buffer.length + separator.length + sentence.length > maxChars) {
      chunks.push(buffer);
      buffer = sentence;
    } else {
      buffer = buffer ? `${buffer}${separator}${sentence}` : sentence;
    }
  }

  if (buffer) chunks.push(buffer);
  return chunks;
}

function splitLongSentence(sentence: string, maxChars: number): string[] {
  const fragments: string[] = [];
  let remaining = sentence;

  while (remaining.length > maxChars) {
    const cut = remaining.lastIndexOf(" ", maxChars);
    const splitAt = cut > 0 ? cut : maxChars;
    fragments.push(remaining.slice(0, splitAt).trim());
    remaining = remaining.slice(splitAt).trim();
  }

  if (remaining) fragments.push(remaining);
  return fragments;
}
