import "dotenv/config";
import { VertexAI } from "@google-cloud/vertexai";
import { parseEpub } from "../src/epub-parser.js";
import { cleanBook } from "../src/text-cleaner.js";

const epubPath = process.argv[2];
const charLimit = Number(process.argv[3]) || 500;

if (!epubPath) {
  console.error("Usage: tsx scripts/test-stress-marks.ts <epub> [chars]");
  process.exit(1);
}

const book = cleanBook(parseEpub(epubPath));
const text = book.blocks
  .map((b) => b.text)
  .join("\n")
  .slice(0, charLimit);

console.log("--- ORIGINAL ---");
console.log(text);
console.log();

const vertex = new VertexAI({
  project: "epub2mp3-491709",
  location: "us-central1",
});

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

console.log("--- WITH STRESS MARKS ---");
console.log(stressed);
