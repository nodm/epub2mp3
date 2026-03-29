import { describe, expect, it } from "vitest";
import { cleanBook, cleanText, SCENE_BREAK_MARKER } from "../src/text-cleaner.js";
import type { ParsedBook } from "../src/types.js";

describe("cleanText", () => {
  it("normalizes unicode to NFC", () => {
    // é as e + combining acute (NFD) → é (NFC)
    const nfd = "caf\u0065\u0301";
    expect(cleanText(nfd)).toBe("café");
  });

  it("strips soft hyphens", () => {
    expect(cleanText("pro\u00adgram\u00adming")).toBe("programming");
  });

  it("strips zero-width chars", () => {
    expect(cleanText("hello\u200bworld\u200c!\ufeff")).toBe("helloworld!");
  });

  it("collapses whitespace", () => {
    expect(cleanText("  hello   world  \n\t test  ")).toBe("hello world test");
  });

  it("handles Russian text", () => {
    expect(cleanText("  Привет\u00ad   мир\u200b  ")).toBe("Привет мир");
  });

  it("handles Ukrainian text", () => {
    expect(cleanText("  Привіт\u00ad   світе\u200b  ")).toBe("Привіт світе");
  });

  it("returns empty string for whitespace-only input", () => {
    expect(cleanText("   \n\t  ")).toBe("");
  });

  it("strips footnote references", () => {
    expect(cleanText("Азирафаэль.[2] Как по мне")).toBe("Азирафаэль. Как по мне");
  });

  it("strips multiple footnote references", () => {
    expect(cleanText("слово[1] и ещё[23]")).toBe("слово и ещё");
  });

  it("replaces * * * scene break with marker", () => {
    expect(cleanText("* * *")).toBe(SCENE_BREAK_MARKER);
  });

  it("replaces spaced scene breaks", () => {
    expect(cleanText("  *  *  *  ")).toBe(SCENE_BREAK_MARKER);
  });

  it("replaces dash scene breaks", () => {
    expect(cleanText("— — —")).toBe(SCENE_BREAK_MARKER);
  });

  it("does not treat single asterisk as scene break", () => {
    expect(cleanText("* alone")).toBe("* alone");
  });
});

describe("cleanBook", () => {
  it("cleans all text blocks and filters empty ones", () => {
    const book: ParsedBook = {
      metadata: { title: "Test", author: "Author", language: "ru" },
      blocks: [
        { chapterIndex: 0, chapterTitle: "Ch1", text: "  Текст\u00ad  главы  " },
        { chapterIndex: 0, chapterTitle: "Ch1", text: "   \n\t  " },
        { chapterIndex: 1, chapterTitle: "Ch2", text: "Вторая\u200b глава" },
      ],
    };

    const result = cleanBook(book);

    expect(result.blocks).toHaveLength(2);
    expect(result.blocks[0].text).toBe("Текст главы");
    expect(result.blocks[1].text).toBe("Вторая глава");
  });

  it("filters copyright boilerplate blocks", () => {
    const book: ParsedBook = {
      metadata: { title: "Test", author: "Author", language: "ru" },
      blocks: [
        { chapterIndex: 0, text: "© Юркан М., перевод на русский язык, 2012" },
        { chapterIndex: 0, text: "© ООО «Издательство «Эксмо», 2012" },
        { chapterIndex: 0, text: "Настоящий текст." },
      ],
    };

    const result = cleanBook(book);
    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0].text).toBe("Настоящий текст.");
  });

  it("preserves metadata unchanged", () => {
    const book: ParsedBook = {
      metadata: { title: "Книга", author: "Автор", language: "uk" },
      blocks: [{ chapterIndex: 0, text: "text" }],
    };

    const result = cleanBook(book);
    expect(result.metadata).toEqual(book.metadata);
  });
});
