# Adding a TTS Provider

The TTS engine uses a `TtsClient` interface for dependency injection. Adding a new provider requires implementing this interface and wiring it into the pipeline.

## The TtsClient interface

```typescript
// src/tts-engine.ts
type TtsClient = {
  synthesizeSpeech(
    request: unknown,
  ): Promise<[{ audioContent?: Uint8Array | string | null }]>;
};
```

The engine calls `client.synthesizeSpeech(request)` where `request` has the shape:

```typescript
{
  input: { text: string },
  voice: { languageCode: string, name: string },
  audioConfig: { audioEncoding: "MP3", sampleRateHertz: 24000 },
}
```

The response must return a tuple `[{ audioContent }]` where `audioContent` is either a `Uint8Array` or a base64-encoded string.

## Example: ElevenLabs provider

```typescript
// src/providers/elevenlabs.ts
import type { TtsClient } from "../tts-engine.js";

export function createElevenLabsClient(apiKey: string): TtsClient {
  return {
    async synthesizeSpeech(request: any) {
      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${request.voice.name}`,
        {
          method: "POST",
          headers: {
            "xi-api-key": apiKey,
            "Content-Type": "application/json",
            Accept: "audio/mpeg",
          },
          body: JSON.stringify({
            text: request.input.text,
            model_id: "eleven_multilingual_v2",
          }),
        },
      );

      const buffer = await response.arrayBuffer();
      return [{ audioContent: new Uint8Array(buffer) }];
    },
  };
}
```

## Example: Vercel AI SDK provider

When the AI SDK adds Google Cloud TTS support (or if using ElevenLabs/OpenAI):

```typescript
// src/providers/ai-sdk.ts
import { experimental_generateSpeech as generateSpeech } from "ai";
import { openai } from "@ai-sdk/openai";
import type { TtsClient } from "../tts-engine.js";

export function createAiSdkClient(): TtsClient {
  return {
    async synthesizeSpeech(request: any) {
      const { audio } = await generateSpeech({
        model: openai.speech("tts-1"),
        text: request.input.text,
        voice: request.voice.name,
      });

      return [{ audioContent: audio }];
    },
  };
}
```

## Wiring into the pipeline

Pass the custom client via `TtsEngineConfig.client`:

```typescript
import { createElevenLabsClient } from "./providers/elevenlabs.js";

const client = createElevenLabsClient(process.env.ELEVENLABS_API_KEY!);

await synthesizeChunks(chunks, {
  client,
  lang: "ru",
  outputDir: tmpDir,
});
```

For CLI integration, add a `--provider` flag to `cli.ts` and construct the appropriate client based on the value.

## Provider checklist

When adding a new provider:

- [ ] Implement the `TtsClient` interface
- [ ] Handle authentication (API key, credentials file, etc.)
- [ ] Map language codes to the provider's format (e.g., `uk` -> `uk-UA` for GCP, `uk` for ElevenLabs)
- [ ] Map voice names to the provider's voice IDs
- [ ] Ensure audio output is MP3 at 24000 Hz (or adjust `audio-processor.ts` if different)
- [ ] Update `cost-estimator.ts` with the provider's pricing model
- [ ] Add the provider's SDK to `package.json` dependencies
- [ ] Add tests with a mock client
- [ ] Document the provider's setup in `docs/`

## Provider comparison

| Provider | Max chars/request | ru/uk/en | Voice cloning | Free tier |
|----------|------------------|----------|---------------|-----------|
| Google Cloud TTS | 5,000 | All 3 | No | 1M WaveNet/mo |
| ElevenLabs | 10,000 (v2) | All 3 | Yes | Limited |
| Azure Speech | Batch: long | All 3 | Enterprise | 500K/mo |
| OpenAI TTS | 4,096 | All 3 | No | None |

If switching to a provider with higher character limits (e.g., ElevenLabs at 10,000), increase `--chunk-size` accordingly for fewer API calls and better prosody.
