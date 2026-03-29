import "dotenv/config";
import { writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { VertexAI } from "@google-cloud/vertexai";
import OpenAI from "openai";
import { parseEpub } from "../src/epub-parser.js";
import { cleanBook } from "../src/text-cleaner.js";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    voice: { type: "string", short: "v", default: "onyx" },
    chars: { type: "string", short: "c", default: "500" },
    tts: { type: "string", short: "t", default: "openai" }, // "openai" or "google"
  },
});

const epubPath = positionals[0];
if (!epubPath) {
  console.error("Usage: tsx scripts/test-stressed-tts.ts <epub> [--voice onyx] [--chars 500] [--tts openai|google]");
  process.exit(1);
}

const book = cleanBook(parseEpub(epubPath));
const charLimit = Number(values.chars);
const text = book.blocks
  .map((b) => b.text)
  .join("\n")
  .slice(0, charLimit);

// Step 1: Add stress marks via Gemini
console.log("Adding stress marks via Gemini 2.5 Flash...");
const vertex = new VertexAI({ project: "epub2mp3-491709", location: "us-central1" });
const model = vertex.getGenerativeModel({ model: "gemini-2.5-flash" });

const result = await model.generateContent({
  contents: [
    {
      role: "user",
      parts: [
        {
          text: `Расставь ударения в русском тексте, добавив символ ударения (\u0301) после ударной гласной в каждом слове. Не меняй текст никак иначе — не добавляй и не удаляй слова, знаки препинания или переносы строк. Только добавь ударения.

Текст:
${text}`,
        },
      ],
    },
  ],
});

const stressed = result.response.candidates?.[0]?.content?.parts?.[0]?.text;
if (!stressed) {
  console.error("No response from Gemini");
  process.exit(1);
}

console.log(`Stressed text (first 200): ${stressed.slice(0, 200)}...`);

// Step 2: TTS
const outDir = resolve("epub/test-output");
await mkdir(outDir, { recursive: true });

if (values.tts === "openai") {
  console.log(`Synthesizing with OpenAI TTS (${values.voice})...`);
  const openai = new OpenAI();
  const response = await openai.audio.speech.create({
    model: "tts-1-hd",
    voice: values.voice as "onyx",
    input: stressed,
  });
  const outPath = resolve(outDir, `stressed-openai-${values.voice}.mp3`);
  await writeFile(outPath, Buffer.from(await response.arrayBuffer()));
  console.log(`→ ${outPath}`);
} else {
  // Google Cloud TTS with SSML
  const { default: textToSpeech } = await import("@google-cloud/text-to-speech");
  const ttsClient = new textToSpeech.TextToSpeechClient();
  const [response] = await ttsClient.synthesizeSpeech({
    input: { text: stressed },
    voice: { languageCode: "ru-RU", name: "ru-RU-Wavenet-D" },
    audioConfig: { audioEncoding: "MP3", sampleRateHertz: 24000 },
  });
  const outPath = resolve(outDir, "stressed-google.mp3");
  await writeFile(outPath, response.audioContent as Buffer);
  console.log(`→ ${outPath}`);
}
