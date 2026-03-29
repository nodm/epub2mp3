import { describe, expect, it } from "vitest";
import { chunkBook, splitSentences } from "../src/chunker.js";
import type { ParsedBook } from "../src/types.js";

describe("splitSentences", () => {
  it("splits English sentences", () => {
    const result = splitSentences("Hello world. How are you? I am fine.", "en");
    expect(result).toEqual(["Hello world.", "How are you?", "I am fine."]);
  });

  it("splits Russian sentences", () => {
    const result = splitSentences("Привет мир. Как дела? Всё хорошо.", "ru");
    expect(result).toEqual(["Привет мир.", "Как дела?", "Всё хорошо."]);
  });

  it("splits Ukrainian sentences", () => {
    const result = splitSentences("Привіт світе. Як справи? Все добре.", "uk");
    expect(result).toEqual(["Привіт світе.", "Як справи?", "Все добре."]);
  });

  it("filters empty segments", () => {
    const result = splitSentences("  Hello.   World.  ", "en");
    expect(result).toEqual(["Hello.", "World."]);
  });
});

describe("chunkBook", () => {
  const makeBook = (
    blocks: { chapterIndex: number; text: string; chapterTitle?: string }[],
  ): ParsedBook => ({
    metadata: { title: "Test", author: "Author", language: "ru" },
    blocks,
  });

  it("produces chunks within the size limit", () => {
    const book = makeBook([
      { chapterIndex: 0, text: "Первое предложение. Второе предложение. Третье предложение." },
    ]);

    const chunks = chunkBook(book, 50);
    for (const chunk of chunks) {
      expect(chunk.text.length).toBeLessThanOrEqual(50);
    }
  });

  it("assigns sequential global indices", () => {
    const book = makeBook([
      { chapterIndex: 0, text: "Первое. Второе." },
      { chapterIndex: 1, text: "Третье. Четвёртое." },
    ]);

    const chunks = chunkBook(book, 20);
    const indices = chunks.map((c) => c.index);
    for (let i = 0; i < indices.length; i++) {
      expect(indices[i]).toBe(i);
    }
  });

  it("preserves chapter boundaries", () => {
    const book = makeBook([
      { chapterIndex: 0, chapterTitle: "Ch1", text: "Текст первой главы." },
      { chapterIndex: 1, chapterTitle: "Ch2", text: "Текст второй главы." },
    ]);

    const chunks = chunkBook(book, 5000);
    expect(chunks).toHaveLength(2);
    expect(chunks[0].chapterIndex).toBe(0);
    expect(chunks[0].chapterTitle).toBe("Ch1");
    expect(chunks[1].chapterIndex).toBe(1);
    expect(chunks[1].chapterTitle).toBe("Ch2");
  });

  it("merges multiple blocks from same chapter", () => {
    const book = makeBook([
      { chapterIndex: 0, text: "Абзац один." },
      { chapterIndex: 0, text: "Абзац два." },
      { chapterIndex: 0, text: "Абзац три." },
    ]);

    const chunks = chunkBook(book, 5000);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].text).toContain("Абзац один.");
    expect(chunks[0].text).toContain("Абзац два.");
    expect(chunks[0].text).toContain("Абзац три.");
  });

  it("splits long sentences at word boundaries", () => {
    const longSentence = `${"слово ".repeat(100).trim()}.`;
    const book = makeBook([{ chapterIndex: 0, text: longSentence }]);

    const chunks = chunkBook(book, 50);
    for (const chunk of chunks) {
      expect(chunk.text.length).toBeLessThanOrEqual(50);
    }
    const reassembled = chunks.map((c) => c.text).join(" ");
    expect(reassembled).toContain("слово");
  });

  it("handles empty book", () => {
    const book = makeBook([]);
    const chunks = chunkBook(book);
    expect(chunks).toEqual([]);
  });

  it("uses default 5000 char limit", () => {
    const text = "Предложение. ".repeat(500);
    const book = makeBook([{ chapterIndex: 0, text }]);

    const chunks = chunkBook(book);
    for (const chunk of chunks) {
      expect(chunk.text.length).toBeLessThanOrEqual(5000);
    }
  });

  it("accumulates sentences greedily up to limit", () => {
    // Each sentence ~20 chars, limit 50 → should fit ~2 per chunk
    const book = makeBook([
      {
        chapterIndex: 0,
        text: "Первое предложение. Второе предложение. Третье предложение. Четвёртое предложение.",
      },
    ]);

    const chunks = chunkBook(book, 50);
    // Should have multiple chunks, each ≤50 chars
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.text.length).toBeLessThanOrEqual(50);
    }
  });
});
