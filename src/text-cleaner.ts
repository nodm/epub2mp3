import type { ParsedBook } from "./types.js";

const ZERO_WIDTH_CHARS = /\u00ad|\u200b|\u200c|\u200d|\ufeff/g;
const COLLAPSE_WHITESPACE = /\s+/g;
const FOOTNOTE_REFS = /\[\d+\]/g;
const SCENE_BREAK = /^\s*[*\u2217\u2022#~—–_-]{1}\s*([*\u2217\u2022#~—–_-]\s*){1,}\s*$/;
const SCENE_BREAK_MARKER = "{{SCENE_BREAK}}";

export function cleanText(text: string): string {
  let cleaned = text
    .normalize("NFC")
    .replace(ZERO_WIDTH_CHARS, "")
    .replace(FOOTNOTE_REFS, "")
    .replace(COLLAPSE_WHITESPACE, " ")
    .trim();

  // Replace scene breaks like "* * *", "— — —", "# # #" etc.
  if (SCENE_BREAK.test(cleaned)) {
    cleaned = SCENE_BREAK_MARKER;
  }

  return cleaned;
}

/** Blocks that are purely boilerplate and should not be read aloud. */
function isBoilerplate(text: string): boolean {
  // Copyright lines: "© ...", "Copyright ..."
  if (/^©|^copyright\b/i.test(text)) return true;
  // "All rights reserved" and similar
  if (/^all rights reserved/i.test(text)) return true;
  return false;
}

export function cleanBook(book: ParsedBook): ParsedBook {
  return {
    metadata: book.metadata,
    blocks: book.blocks
      .map((block) => ({
        ...block,
        text: cleanText(block.text),
      }))
      .filter((block) => block.text.length > 0 && !isBoilerplate(block.text)),
  };
}

export { SCENE_BREAK_MARKER };
