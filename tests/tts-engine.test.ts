import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TtsClient } from "../src/tts-engine.js";
import { synthesizeChunks } from "../src/tts-engine.js";
import type { Chunk } from "../src/types.js";

function makeChunk(index: number, text: string, chapterIndex = 0): Chunk {
  return { chapterIndex, chapterTitle: "Chapter 1", index, text };
}

function makeMockClient(
  audioData = "fake-mp3-audio",
): TtsClient & { synthesizeSpeech: ReturnType<typeof vi.fn> } {
  return {
    synthesizeSpeech: vi.fn().mockResolvedValue([{ audioContent: Buffer.from(audioData) }]),
  };
}

describe("synthesizeChunks", () => {
  let outputDir: string;

  beforeEach(async () => {
    outputDir = await mkdtemp(join(tmpdir(), "tts-test-"));
  });

  afterEach(async () => {
    await rm(outputDir, { recursive: true, force: true });
  });

  it("returns empty array for empty chunks", async () => {
    const result = await synthesizeChunks([], { lang: "ru", outputDir });
    expect(result).toEqual([]);
  });

  it("synthesizes chunks and writes audio files", async () => {
    const client = makeMockClient();
    const chunks = [makeChunk(0, "Привет мир."), makeChunk(1, "Как дела?")];

    const results = await synthesizeChunks(chunks, { lang: "ru", outputDir, client });

    expect(results).toHaveLength(2);
    expect(results[0].chunk.index).toBe(0);
    expect(results[1].chunk.index).toBe(1);

    const files = await readdir(outputDir);
    expect(files.sort()).toEqual(["chunk_00000.mp3", "chunk_00001.mp3"]);

    const content = await readFile(results[0].audioPath);
    expect(content.toString()).toBe("fake-mp3-audio");
  });

  it("calls TTS client with SSML input for English", async () => {
    const client = makeMockClient();
    const chunks = [makeChunk(0, "Hello world.")];

    await synthesizeChunks(chunks, { lang: "en", outputDir, client });

    expect(client.synthesizeSpeech).toHaveBeenCalledWith({
      input: { ssml: "<speak>Hello world.</speak>" },
      voice: { languageCode: "en-US", name: "en-US-Neural2-D" },
      audioConfig: { audioEncoding: "MP3", sampleRateHertz: 24000 },
    });
  });

  it("uses default Russian Neural2 voice", async () => {
    const client = makeMockClient();
    await synthesizeChunks([makeChunk(0, "Текст.")], { lang: "ru", outputDir, client });

    expect(client.synthesizeSpeech).toHaveBeenCalledWith(
      expect.objectContaining({
        voice: { languageCode: "ru-RU", name: "ru-RU-Neural2-D" },
      }),
    );
  });

  it("uses default Ukrainian Wavenet voice", async () => {
    const client = makeMockClient();
    await synthesizeChunks([makeChunk(0, "Текст.")], { lang: "uk", outputDir, client });

    expect(client.synthesizeSpeech).toHaveBeenCalledWith(
      expect.objectContaining({
        voice: { languageCode: "uk-UA", name: "uk-UA-Wavenet-A" },
      }),
    );
  });

  it("sends SSML with interjection handling for Russian", async () => {
    const client = makeMockClient();
    await synthesizeChunks([makeChunk(0, "Хм... ладно.")], { lang: "ru", outputDir, client });

    const call = client.synthesizeSpeech.mock.calls[0][0] as { input: { ssml: string } };
    expect(call.input.ssml).toContain("<speak>");
    expect(call.input.ssml).toContain('<sub alias="хмм">');
  });

  it("uses custom voice when provided", async () => {
    const client = makeMockClient();
    await synthesizeChunks([makeChunk(0, "Текст.")], {
      lang: "ru",
      voice: "ru-RU-Standard-A",
      outputDir,
      client,
    });

    expect(client.synthesizeSpeech).toHaveBeenCalledWith(
      expect.objectContaining({
        voice: { languageCode: "ru-RU", name: "ru-RU-Standard-A" },
      }),
    );
  });

  it("reports progress via callback", async () => {
    const client = makeMockClient();
    const chunks = [makeChunk(0, "One."), makeChunk(1, "Two."), makeChunk(2, "Three.")];
    const progress: [number, number][] = [];

    await synthesizeChunks(chunks, {
      lang: "en",
      outputDir,
      client,
      onProgress: (completed, total) => progress.push([completed, total]),
    });

    expect(progress).toHaveLength(3);
    expect(progress[progress.length - 1]).toEqual([3, 3]);
    for (const [, total] of progress) {
      expect(total).toBe(3);
    }
  });

  it("respects concurrency limit", async () => {
    let concurrent = 0;
    let maxConcurrent = 0;

    const client: TtsClient = {
      synthesizeSpeech: vi.fn().mockImplementation(async () => {
        concurrent++;
        maxConcurrent = Math.max(maxConcurrent, concurrent);
        await new Promise((r) => setTimeout(r, 50));
        concurrent--;
        return [{ audioContent: Buffer.from("audio") }];
      }),
    };

    const chunks = Array.from({ length: 6 }, (_, i) => makeChunk(i, `Chunk ${i}.`));
    await synthesizeChunks(chunks, { lang: "en", outputDir, client, concurrency: 2 });

    expect(maxConcurrent).toBeLessThanOrEqual(2);
  });

  it("throws when no audio content returned", async () => {
    const client: TtsClient = {
      synthesizeSpeech: vi.fn().mockResolvedValue([{ audioContent: null }]),
    };

    await expect(
      synthesizeChunks([makeChunk(0, "Text.")], { lang: "en", outputDir, client }),
    ).rejects.toThrow("No audio returned for chunk 0");
  });
});
