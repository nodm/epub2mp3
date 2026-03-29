import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseEpub, parseEpubBuffer } from "../src/epub-parser.js";

const FIXTURE_PATH = join(__dirname, "fixtures", "sample.epub");

describe("parseEpub", () => {
  it("extracts metadata from OPF", () => {
    const book = parseEpub(FIXTURE_PATH);

    expect(book.metadata.title).toBe("Тестовая книга");
    expect(book.metadata.author).toBe("Тарас Шевченко");
    expect(book.metadata.language).toBe("uk");
  });

  it("extracts all chapters from spine", () => {
    const book = parseEpub(FIXTURE_PATH);

    const chapterIndices = [...new Set(book.blocks.map((b) => b.chapterIndex))];
    expect(chapterIndices).toEqual([0, 1, 2]);
  });

  it("extracts paragraph text from XHTML", () => {
    const book = parseEpub(FIXTURE_PATH);

    const ch1Blocks = book.blocks.filter((b) => b.chapterIndex === 0);
    // h1 + 2 paragraphs
    expect(ch1Blocks.length).toBeGreaterThanOrEqual(2);

    const texts = ch1Blocks.map((b) => b.text);
    expect(texts).toContain("Реве та стогне Дніпр широкий, сердитий вітер завива.");
    expect(texts).toContain("Додолу верби гне високі, горами хвилю підійма.");
  });

  it("assigns chapter titles from NAV TOC", () => {
    const book = parseEpub(FIXTURE_PATH);

    const ch1 = book.blocks.find((b) => b.chapterIndex === 0);
    expect(ch1?.chapterTitle).toBe("Розділ перший");

    const ch2 = book.blocks.find((b) => b.chapterIndex === 1);
    expect(ch2?.chapterTitle).toBe("Розділ другий");

    const ch3 = book.blocks.find((b) => b.chapterIndex === 2);
    expect(ch3?.chapterTitle).toBe("Розділ третій");
  });

  it("preserves spine order", () => {
    const book = parseEpub(FIXTURE_PATH);

    const indices = book.blocks.map((b) => b.chapterIndex);
    for (let i = 1; i < indices.length; i++) {
      expect(indices[i]).toBeGreaterThanOrEqual(indices[i - 1]);
    }
  });

  it("extracts heading text as blocks", () => {
    const book = parseEpub(FIXTURE_PATH);

    const ch1Blocks = book.blocks.filter((b) => b.chapterIndex === 0);
    expect(ch1Blocks[0].text).toBe("Розділ перший");
  });
});

describe("parseEpubBuffer", () => {
  it("parses from Buffer", () => {
    const data = readFileSync(FIXTURE_PATH);
    const book = parseEpubBuffer(data);

    expect(book.metadata.title).toBe("Тестовая книга");
    expect(book.blocks.length).toBeGreaterThan(0);
  });
});

describe("error handling", () => {
  it("throws on non-existent file", () => {
    expect(() => parseEpub("/nonexistent.epub")).toThrow();
  });

  it("throws on invalid zip", () => {
    expect(() => parseEpubBuffer(Buffer.from("not a zip"))).toThrow();
  });
});
