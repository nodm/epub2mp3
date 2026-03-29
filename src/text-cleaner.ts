import type { ParsedBook } from "./types.js";

const ZERO_WIDTH_CHARS = /\u00ad|\u200b|\u200c|\u200d|\ufeff/g;
const COLLAPSE_WHITESPACE = /\s+/g;

export function cleanText(text: string): string {
  return text
    .normalize("NFC")
    .replace(ZERO_WIDTH_CHARS, "")
    .replace(COLLAPSE_WHITESPACE, " ")
    .trim();
}

export function cleanBook(book: ParsedBook): ParsedBook {
  return {
    metadata: book.metadata,
    blocks: book.blocks
      .map((block) => ({
        ...block,
        text: cleanText(block.text),
      }))
      .filter((block) => block.text.length > 0),
  };
}
