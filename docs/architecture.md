# Architecture

epub2mp3 converts EPUB eBooks to MP3 audiobooks through a six-stage sequential pipeline. Each stage has a single responsibility, takes immutable input, and produces output for the next stage.

## Pipeline overview

```
                    ┌─────────────────┐
                    │   EPUB file     │
                    └────────┬────────┘
                             │
                    ┌────────v────────┐
                    │  1. EPUB Parser │  adm-zip + htmlparser2
                    │  epub-parser.ts │  Extracts text blocks + metadata from EPUB ZIP
                    └────────┬────────┘
                             │ ParsedBook
                    ┌────────v────────┐
                    │  2. Text Cleaner│  Native JS (zero deps)
                    │ text-cleaner.ts │  NFC normalization, strip invisible chars
                    └────────┬────────┘
                             │ ParsedBook (cleaned)
                    ┌────────v────────┐
                    │  3. Chunker     │  Intl.Segmenter (zero deps)
                    │   chunker.ts    │  Sentence-boundary splitting, ≤5000 chars
                    └────────┬────────┘
                             │ Chunk[]
                    ┌────────v────────┐
                    │  4. TTS Engine  │  @google-cloud/text-to-speech
                    │  tts-engine.ts  │  Parallel WaveNet synthesis with retry
                    └────────┬────────┘
                             │ SynthesizedChunk[] (MP3 files in tmp dir)
                    ┌────────v────────┐
                    │  5. Audio Proc  │  ffmpeg (execa)
                    │audio-processor  │  Volume normalization (loudnorm)
                    └────────┬────────┘
                             │ Normalized MP3 files
                    ┌────────v────────┐
                    │  6. Exporter    │  ffmpeg concat + node-id3
                    │audio-exporter   │  Join segments, write ID3 tags
                    └────────┬────────┘
                             │
                    ┌────────v────────┐
                    │  Output MP3(s)  │
                    └─────────────────┘
```

## Data flow

All shared types live in `src/types.ts`. Data flows forward through the pipeline via these types:

```
EPUB file path
    │
    ▼
ParsedBook { metadata: BookMetadata, blocks: TextBlock[] }
    │
    ▼ (text cleaning — same type, cleaned content)
ParsedBook
    │
    ▼
Chunk[] { chapterIndex, chapterTitle?, index, text }
    │
    ▼
SynthesizedChunk[] { chunk: Chunk, audioPath: string }
    │
    ▼
string[] (output MP3 file paths)
```

### Key types

| Type | Purpose |
|------|---------|
| `Language` | `"en" \| "uk" \| "ru"` |
| `BookMetadata` | title, author, language |
| `TextBlock` | One paragraph/heading from one chapter |
| `ParsedBook` | Metadata + all text blocks |
| `Chunk` | A segment of text ready for TTS (≤5000 chars) |
| `SynthesizedChunk` | A chunk paired with its synthesized MP3 file path |
| `PipelineConfig` | All runtime settings (input, output, lang, voice, etc.) |

## Stage details

### Stage 1: EPUB Parser (`epub-parser.ts`)

EPUB files are ZIP archives containing XHTML content, an OPF manifest, and a navigation document.

**Parse sequence:**
1. Unzip EPUB with `adm-zip`
2. Read `META-INF/container.xml` to find the OPF file path
3. Parse OPF to extract:
   - **Metadata:** `<dc:title>`, `<dc:creator>`, `<dc:language>`
   - **Manifest:** maps item IDs to content file paths
   - **Spine:** ordered list of item IDs (reading order)
4. If a NAV document exists (EPUB 3 `<nav epub:type="toc">`), extract chapter titles from `<a>` elements
5. For each spine item, parse the XHTML and extract text from `<p>` and `<h1>`–`<h6>` elements
6. Produce a `ParsedBook` with one `TextBlock` per paragraph, preserving chapter index and title

**Dual entry points:**
- `parseEpub(filePath)` — reads from disk (CLI use)
- `parseEpubBuffer(data)` — reads from Buffer (future web API use)

### Stage 2: Text Cleaner (`text-cleaner.ts`)

Minimal text normalization using native JavaScript. Zero dependencies.

- **NFC normalization:** `String.prototype.normalize("NFC")` — ensures composed Unicode forms
- **Strip invisible characters:** soft hyphens (`\u00ad`), zero-width spaces/joiners (`\u200b`, `\u200c`, `\u200d`), BOM (`\ufeff`)
- **Collapse whitespace:** replace runs of `\s+` with single space, trim
- **Filter empty blocks:** blocks that become empty after cleaning are removed

### Stage 3: Chunker (`chunker.ts`)

Splits cleaned text into chunks suitable for TTS synthesis. Default limit: **5000 characters** (Google Cloud TTS sync API maximum).

**Algorithm:**
1. **Group** text blocks by chapter — consecutive blocks from the same chapter are joined with newlines
2. **Sentence split** using `Intl.Segmenter(lang, { granularity: "sentence" })` — locale-aware, handles Russian/Ukrainian/English punctuation correctly, zero dependencies
3. **Greedy accumulation** — add sentences to a buffer until the next sentence would exceed the limit, then flush
4. **Long sentence fallback** — sentences exceeding the limit are split at the last whitespace within bounds; if no whitespace exists, hard-cut at the limit

**Why Intl.Segmenter over NLTK/regex:**
- Native to Node.js 16+, zero dependencies
- Locale-aware: handles Cyrillic abbreviations, quotation marks, and ellipsis correctly
- No model downloads or setup required

### Stage 4: TTS Engine (`tts-engine.ts`)

Synthesizes each chunk into an MP3 file using Google Cloud Text-to-Speech WaveNet voices.

**Key behaviors:**
- **Parallel requests:** uses `p-limit` to process multiple chunks concurrently (default: 3)
- **Retry with backoff:** wraps each API call with `withRetry` (3 retries, exponential backoff) for 429/5xx/timeout errors
- **Progress callback:** reports `(completed, total)` after each chunk
- **DI-friendly:** accepts an optional `TtsClient` interface for testing without GCP credentials

**Audio output:** MP3, 24000 Hz sample rate, written to a temporary directory. File naming: `chunk_00000.mp3`, `chunk_00001.mp3`, etc.

**Default voices:**

| Language | Voice ID |
|----------|----------|
| English  | `en-US-Wavenet-D` |
| Ukrainian | `uk-UA-Wavenet-A` |
| Russian  | `ru-RU-Wavenet-D` |

### Stage 5: Audio Processor (`audio-processor.ts`)

Post-processes synthesized audio using ffmpeg.

- **Volume normalization:** applies the `loudnorm` filter (`I=-16, TP=-1.5, LRA=11`) per EBU R128 standard. This ensures consistent volume across all chapters.
- **Crossfade (optional):** 50ms triangular crossfade between adjacent segments using ffmpeg's `acrossfade` filter. Less critical with 5000-char chunks (segments are 30–60 seconds each).
- **In-place normalization:** writes to a temp file, then replaces the original to avoid partial writes.

### Stage 6: Audio Exporter (`audio-exporter.ts`)

Joins normalized segments into final MP3 output and writes ID3v2 metadata.

**Two export modes:**

| Mode | Trigger | Output |
|------|---------|--------|
| Single file | default | `<Title>.mp3` |
| Per-chapter | `--split-chapters` | `<Title>/Chapter_01_<Title>.mp3`, `Chapter_02_...`, etc. |

**MP3 concatenation:** uses ffmpeg's `concat` demuxer with `-c copy` for lossless joining (no re-encoding).

**ID3 tags:** written via `node-id3`:
- `title`: book title (single-file) or chapter title (per-chapter)
- `artist`: book author
- `language`: ISO 639-1 code

## Pipeline orchestrator (`pipeline.ts`)

Coordinates all six stages with:

- **Timing:** measures total pipeline duration via `performance.now()`
- **Logging:** accepts a `log` function (defaults to `console.log`) for progress messages
- **Cost estimation:** calculates total characters and estimated GCP cost before synthesis
- **Temp directory:** creates a unique temp dir for intermediate MP3 chunks, cleaned up on completion (including on failure via `finally`)
- **Output path derivation:** if no `--output` is given, derives from the book title (slugified)

## CLI (`cli.ts`)

Entry point using Commander.js. Handles:

- Argument parsing and validation
- `--dry-run` mode: parses EPUB, chunks text, shows cost estimate without calling TTS
- Error reporting: catches exceptions and prints clean error messages

## Utility modules

### `utils/retry.ts`
Exponential backoff with jitter for transient failures:
- Retryable: HTTP 429, 5xx, `ECONNRESET`, timeout
- Non-retryable: 401, 403, 400 (fail immediately)
- Formula: `min(baseDelay * 2^attempt + random(0..200), maxDelay)`

### `utils/cost-estimator.ts`
Estimates Google Cloud TTS cost:
- WaveNet pricing: $16 per 1M characters
- Free tier: 1M WaveNet characters/month
- Reports whether the conversion falls within the free tier

## Design decisions

**Why Google Cloud TTS (not local XTTS v2):**
The predecessor project (fb2mp3) used a local XTTS v2 model limited to 250 characters per request (~150 effective for Russian). Cloud TTS supports 5000 chars/request — a 20x increase — eliminating choppy audio from frequent chunk boundaries.

**Why not Vercel AI SDK for TTS:**
The AI SDK's `generateSpeech` API (still `experimental_`) only supports OpenAI, Azure, and ElevenLabs as TTS providers. Google Cloud TTS is not available through the AI SDK. The `TtsClient` interface allows swapping providers without changing the pipeline.

**Why `type` over `interface`:**
Project convention. All shared data definitions use `type` for consistency.

**Why Biome over ESLint/Prettier:**
Single tool for linting + formatting. Rust-based, fast. Eliminates config sprawl from separate ESLint + Prettier setups.

**Why `Intl.Segmenter` over NLTK/third-party:**
Native to Node.js 16+, locale-aware, zero dependencies. Handles Russian and Ukrainian sentence boundaries correctly without downloading language models.
