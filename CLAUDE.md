# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm test              # run tests (vitest)
pnpm test:watch        # watch mode
pnpm lint              # biome check
pnpm lint:fix          # biome check --write
pnpm format            # biome format --write
pnpm build             # tsc
pnpm dev -- <args>     # run CLI via tsx (e.g. pnpm dev -- book.epub --lang uk --dry-run)
```

## Architecture

Six-stage sequential pipeline in `src/`:

```
EPUB → epub-parser.ts → text-cleaner.ts → chunker.ts → tts-engine.ts → audio-processor.ts → audio-exporter.ts
```

- **`pipeline.ts`** — orchestrates all stages, manages temp dirs, reports progress
- **`types.ts`** — all shared types (`type` not `interface`, project convention)
- **`cli.ts`** — commander entry-point, validates args, calls `pipeline.ts`

Key constraints:
- Chunker uses `Intl.Segmenter` for locale-aware sentence splitting, default 5000-char limit
- TTS Engine uses Google Cloud TTS WaveNet via `@google-cloud/text-to-speech`; accepts a `TtsClient` interface for DI/testing
- Audio stages require `ffmpeg` on PATH
- `node-id3` for ID3v2 tag writing

## Tooling

- **pnpm** (not npm/yarn)
- **Biome** for linting + formatting (not ESLint/Prettier)
- **vitest** for tests
- **TypeScript** strict mode, ESM (`"type": "module"`)
- Use `type` not `interface` for data definitions

## Testing

Tests in `tests/`. TTS engine tests use DI (mock `TtsClient`) — no GCP credentials needed. Audio processor/exporter tests are skipped if ffmpeg is unavailable. CLI tests spawn the process via `execFileSync`.
