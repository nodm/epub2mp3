# epub2mp3

Convert EPUB eBooks to MP3 audiobooks using **Google Cloud Text-to-Speech** (WaveNet voices).

## Features

- **Three languages:** English, Ukrainian, Russian
- **WaveNet voices** for natural, high-quality speech
- **Per-chapter splitting** or single-file output
- **Parallel synthesis** with configurable concurrency
- **Cost estimation** before conversion (`--dry-run`)
- **Volume normalization** via ffmpeg loudnorm
- **ID3 metadata** tags on every output file

## Prerequisites

| Requirement | Version |
|-------------|---------|
| [Node.js](https://nodejs.org) | 20+ |
| [ffmpeg](https://ffmpeg.org/download.html) | any recent, on `PATH` |
| [Google Cloud](https://cloud.google.com/text-to-speech/docs/before-you-begin) credentials | `GOOGLE_APPLICATION_CREDENTIALS` env var |

Google Cloud TTS free tier: **1M WaveNet characters/month** (a typical novel costs $0).

## Installation

```bash
git clone https://github.com/nodm/epub-reader.git
cd epub-reader
pnpm install
```

## Usage

```bash
# Cost estimate (no API calls)
pnpm dev -- book.epub --lang uk --dry-run

# Convert with default Ukrainian WaveNet voice
pnpm dev -- book.epub --lang uk

# Custom voice, split per chapter, output to directory
pnpm dev -- book.epub --lang ru --voice ru-RU-Wavenet-B --split-chapters --output ./chapters/

# English, single file, custom output path
pnpm dev -- book.epub --lang en --output audiobook.mp3
```

### All options

```
epub2mp3 <input.epub> [options]

  --lang <en|uk|ru>       Language (required)
  --voice <name>          GCP voice name (default: auto per language)
  --output <path>         Output file or directory
  --split-chapters        One MP3 per chapter
  --crossfade             Crossfade between segments
  --concurrency <n>       Parallel TTS requests (default: 3)
  --chunk-size <n>        Max characters per chunk (default: 5000)
  --dry-run               Show cost estimate without converting
  --help                  Show help
```

### Default voices

| Language | Voice |
|----------|-------|
| English | `en-US-Wavenet-D` |
| Ukrainian | `uk-UA-Wavenet-A` |
| Russian | `ru-RU-Wavenet-D` |

Browse all available voices: [Google Cloud TTS voices](https://cloud.google.com/text-to-speech/docs/voices)

## Pipeline

```
EPUB file
    |
    v
[1] EPUB Parser        -- extract text and metadata from EPUB ZIP
    |
    v
[2] Text Cleaner       -- NFC normalization, strip footnotes/boilerplate, scene break detection
    |
    v
[3] Sentence Chunker   -- split at sentence boundaries (Intl.Segmenter), <= 5000 chars
    |
    v
[4] TTS Engine         -- SSML synthesis via Google Cloud TTS (interjection handling, punctuation breaks)
    |
    v
[5] Audio Processor    -- volume normalization (ffmpeg loudnorm)
    |
    v
[6] Audio Exporter     -- MP3 concat (ffmpeg), ID3 tags (node-id3)
```

## Documentation

- [Architecture](docs/architecture.md) — pipeline design, data flow, stage details, design decisions
- [GCP Setup](docs/gcp-setup.md) — Google Cloud credentials, available voices, troubleshooting
- [EPUB Format](docs/epub-format.md) — how EPUBs are parsed, supported structures, edge cases
- [Adding TTS Providers](docs/adding-tts-providers.md) — how to implement ElevenLabs, OpenAI, or other providers

## Test Scripts

Helper scripts in `scripts/` for experimenting with TTS quality before running the full pipeline.

### Preview SSML output

See how text will be transformed (interjection handling, punctuation breaks, XML escaping):

```bash
npx tsx scripts/preview-ssml.ts <epub> [lang] [chars]
npx tsx scripts/preview-ssml.ts book.epub ru 1000
```

### Test fragment with Google TTS

Synthesize a short fragment using the main pipeline (Google Cloud TTS):

```bash
GOOGLE_APPLICATION_CREDENTIALS=./key.json npx tsx scripts/test-fragment.ts <epub> [--lang ru] [--voice name] [--chars 500]
```

### Test fragment with OpenAI TTS

Compare OpenAI TTS voices (`alloy`, `ash`, `ballad`, `coral`, `echo`, `fable`, `nova`, `onyx`, `sage`, `shimmer`):

```bash
npx tsx scripts/test-openai-tts.ts <epub> [--voice onyx] [--chars 500] [--model tts-1-hd]
```

Requires `OPENAI_API_KEY` in `.env`.

### Gemini stress marks

Add Russian stress marks (ударения) via Gemini 2.5 Flash to improve pronunciation:

```bash
GOOGLE_APPLICATION_CREDENTIALS=./key.json npx tsx scripts/test-stress-marks.ts <epub> [chars]
```

### Combined: stress marks + TTS

Full chain — Gemini stress annotation → TTS synthesis:

```bash
GOOGLE_APPLICATION_CREDENTIALS=./key.json npx tsx scripts/test-stressed-tts.ts <epub> [--voice onyx] [--chars 1000] [--tts openai|google]
```

### List available Google voices

```bash
GOOGLE_APPLICATION_CREDENTIALS=./key.json npx tsx scripts/list-voices.ts
```

## Development

```bash
pnpm test              # run tests
pnpm test:watch        # watch mode
pnpm lint              # biome check
pnpm lint:fix          # auto-fix
pnpm build             # tsc
```

## License

MIT
