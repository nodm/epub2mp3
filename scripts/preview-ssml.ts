import { parseEpub } from "../src/epub-parser.js";
import { textToSsml } from "../src/ssml.js";
import { cleanBook } from "../src/text-cleaner.js";

const [, , epubPath, langArg, limitArg] = process.argv;
if (!epubPath) {
  console.error("Usage: tsx scripts/preview-ssml.ts <epub> <lang> [chars]");
  process.exit(1);
}

const lang = (langArg ?? "ru") as "en" | "uk" | "ru";
const limit = Number(limitArg) || 500;

const book = cleanBook(parseEpub(epubPath));
const text = book.blocks
  .map((b) => b.text)
  .join(" ")
  .slice(0, limit);

console.log("--- RAW TEXT ---");
console.log(text);
console.log("\n--- SSML ---");
console.log(textToSsml(text, lang));
