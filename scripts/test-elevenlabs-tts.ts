import "dotenv/config";
import { writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { parseEpub } from "../src/epub-parser.js";
import { cleanBook } from "../src/text-cleaner.js";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    voice: { type: "string", short: "v", default: "Daniel" },
    chars: { type: "string", short: "c", default: "500" },
    "list-voices": { type: "boolean", default: false },
  },
});

const client = new ElevenLabsClient();

if (values["list-voices"]) {
  const voices = await client.voices.getAll();
  for (const v of voices.voices) {
    const langs = v.labels?.language ?? "";
    console.log(`${v.voiceId}  ${v.name}  (${langs})`);
  }
  process.exit(0);
}

const epubPath = positionals[0];
if (!epubPath) {
  console.error(
    "Usage: tsx scripts/test-elevenlabs-tts.ts <epub> [--voice name] [--chars 500]\n" +
      "       tsx scripts/test-elevenlabs-tts.ts --list-voices",
  );
  process.exit(1);
}

const book = cleanBook(parseEpub(epubPath));
const charLimit = Number(values.chars);
const text = book.blocks
  .map((b) => b.text)
  .join("\n")
  .slice(0, charLimit);

console.log(`Text: ${text.length} chars`);
console.log(`Voice: ${values.voice}`);
console.log(`First 100 chars: ${text.slice(0, 100)}...`);

// Find voice by name (match start of name, since full names include description)
const voices = await client.voices.getAll();
const voice = voices.voices.find(
  (v) => v.name?.toLowerCase().startsWith(values.voice!.toLowerCase()),
);
if (!voice) {
  console.error(`Voice "${values.voice}" not found. Use --list-voices to see available voices.`);
  process.exit(1);
}
const voiceId = voice.voiceId;

console.log(`Voice ID: ${voiceId}`);
console.log("Synthesizing...");

const audio = await client.textToSpeech.convert(voiceId, {
  text,
  modelId: "eleven_multilingual_v2",
  outputFormat: "mp3_44100_128",
});

// Collect stream into buffer
const chunks: Uint8Array[] = [];
for await (const chunk of audio) {
  chunks.push(chunk);
}
const buffer = Buffer.concat(chunks);

const outDir = resolve("epub/test-output");
await mkdir(outDir, { recursive: true });
const outPath = resolve(outDir, `elevenlabs-${values.voice}.mp3`);
await writeFile(outPath, buffer);
console.log(`→ ${outPath}`);
