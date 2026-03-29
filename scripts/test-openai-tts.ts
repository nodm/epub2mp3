import "dotenv/config";
import { writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import OpenAI from "openai";
import { parseEpub } from "../src/epub-parser.js";
import { cleanBook } from "../src/text-cleaner.js";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    voice: { type: "string", short: "v", default: "nova" },
    chars: { type: "string", short: "c", default: "500" },
    model: { type: "string", short: "m", default: "tts-1-hd" },
  },
});

const epubPath = positionals[0];
if (!epubPath) {
  console.error(
    "Usage: tsx scripts/test-openai-tts.ts <epub> [--voice nova] [--chars 500] [--model tts-1-hd]",
  );
  console.error("Voices: alloy, ash, ballad, coral, echo, fable, nova, onyx, sage, shimmer");
  process.exit(1);
}

const book = cleanBook(parseEpub(epubPath));
const charLimit = Number(values.chars);
const text = book.blocks
  .map((b) => b.text)
  .join("\n")
  .slice(0, charLimit);

console.log(`Text: ${text.length} chars`);
console.log(`Voice: ${values.voice}, Model: ${values.model}`);
console.log(`First 100 chars: ${text.slice(0, 100)}...`);

const client = new OpenAI();
const response = await client.audio.speech.create({
  model: values.model!,
  voice: values.voice as "nova",
  input: text,
});

const outDir = resolve("epub/test-output");
await mkdir(outDir, { recursive: true });
const outPath = resolve(outDir, `openai-${values.voice}.mp3`);

const buffer = Buffer.from(await response.arrayBuffer());
await writeFile(outPath, buffer);
console.log(`→ ${outPath}`);
