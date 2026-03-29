import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import textToSpeech from "@google-cloud/text-to-speech";
import pLimit from "p-limit";
import { textToSsml } from "./ssml.js";
import type { Chunk, Language, SynthesizedChunk } from "./types.js";
import { withRetry } from "./utils/retry.js";

export type { SynthesizedChunk };

export type TtsClient = {
  synthesizeSpeech(request: unknown): Promise<[{ audioContent?: Uint8Array | string | null }]>;
};

export type TtsEngineConfig = {
  client?: TtsClient;
  voice?: string;
  lang: Language;
  concurrency?: number;
  outputDir: string;
  onProgress?: (completed: number, total: number) => void;
};

const DEFAULT_VOICES: Record<Language, string> = {
  en: "en-US-Wavenet-D",
  uk: "uk-UA-Wavenet-A",
  ru: "ru-RU-Wavenet-D",
};

const LANGUAGE_CODES: Record<Language, string> = {
  en: "en-US",
  uk: "uk-UA",
  ru: "ru-RU",
};

export function createTtsClient(): TtsClient {
  return new textToSpeech.TextToSpeechClient() as unknown as TtsClient;
}

export async function synthesizeChunks(
  chunks: Chunk[],
  config: TtsEngineConfig,
): Promise<SynthesizedChunk[]> {
  if (chunks.length === 0) return [];

  const client = config.client ?? createTtsClient();
  const limit = pLimit(config.concurrency ?? 3);
  let completed = 0;

  const tasks = chunks.map((chunk) =>
    limit(() =>
      withRetry(
        async () => {
          const audioPath = await synthesizeOne(client, chunk, config);
          completed++;
          config.onProgress?.(completed, chunks.length);
          return { chunk, audioPath };
        },
        { maxRetries: 3, baseDelayMs: 1000 },
      ),
    ),
  );

  return Promise.all(tasks);
}

async function synthesizeOne(
  client: TtsClient,
  chunk: Chunk,
  config: TtsEngineConfig,
): Promise<string> {
  const voiceName = config.voice ?? DEFAULT_VOICES[config.lang];
  const languageCode = LANGUAGE_CODES[config.lang];

  const ssml = textToSsml(chunk.text, config.lang);

  const [response] = await client.synthesizeSpeech({
    input: { ssml },
    voice: { languageCode, name: voiceName },
    audioConfig: { audioEncoding: "MP3", sampleRateHertz: 24000 },
  });

  if (!response.audioContent) {
    throw new Error(`No audio returned for chunk ${chunk.index}`);
  }

  const audioPath = join(config.outputDir, `chunk_${String(chunk.index).padStart(5, "0")}.mp3`);

  const content =
    response.audioContent instanceof Uint8Array
      ? response.audioContent
      : Buffer.from(response.audioContent, "base64");

  await writeFile(audioPath, content);
  return audioPath;
}
