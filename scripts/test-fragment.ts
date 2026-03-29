import { mkdir } from "node:fs/promises";
import { parseArgs } from "node:util";
import { resolve } from "node:path";
import { chunkBook } from "../src/chunker.js";
import { parseEpub } from "../src/epub-parser.js";
import { cleanBook } from "../src/text-cleaner.js";
import { createTtsClient, synthesizeChunks } from "../src/tts-engine.js";
import type { Language } from "../src/types.js";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    lang: { type: "string", short: "l", default: "ru" },
    voice: { type: "string", short: "v" },
    chars: { type: "string", short: "c", default: "500" },
  },
});

const epubPath = positionals[0];
if (!epubPath) {
  console.error("Usage: tsx scripts/test-fragment.ts <epub> [--lang ru] [--voice name] [--chars 500]");
  process.exit(1);
}

const lang = values.lang as Language;
const charLimit = Number(values.chars);

const book = cleanBook(parseEpub(epubPath));

// Truncate text to charLimit
let remaining = charLimit;
const truncatedBlocks = [];
for (const block of book.blocks) {
  if (remaining <= 0) break;
  if (block.text.length <= remaining) {
    truncatedBlocks.push(block);
    remaining -= block.text.length;
  } else {
    truncatedBlocks.push({ ...block, text: block.text.slice(0, remaining) });
    remaining = 0;
  }
}

const truncatedBook = { metadata: book.metadata, blocks: truncatedBlocks };
const chunks = chunkBook(truncatedBook);

console.log(`Text: ${chunks.reduce((n, c) => n + c.text.length, 0)} chars, ${chunks.length} chunk(s)`);
if (values.voice) console.log(`Voice: ${values.voice}`);

const outDir = resolve("epub/test-output");
await mkdir(outDir, { recursive: true });

const results = await synthesizeChunks(chunks, {
  lang,
  voice: values.voice,
  outputDir: outDir,
  client: createTtsClient(),
  onProgress: (done, total) => console.log(`  [${done}/${total}]`),
});

for (const r of results) {
  console.log(`→ ${r.audioPath}`);
}
