# Google Cloud TTS Setup

This guide walks through setting up Google Cloud Text-to-Speech credentials for epub2mp3.

## 1. Create a Google Cloud project

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project (or select an existing one)
3. Note the **Project ID**

## 2. Enable the Text-to-Speech API

```bash
gcloud services enable texttospeech.googleapis.com
```

Or via the console: **APIs & Services > Enable APIs > Cloud Text-to-Speech API**

## 3. Create a service account

```bash
# Create the service account
gcloud iam service-accounts create epub2mp3-tts \
  --display-name="epub2mp3 TTS"

# Create and download a key file
gcloud iam service-accounts keys create ~/epub2mp3-key.json \
  --iam-account=epub2mp3-tts@YOUR_PROJECT_ID.iam.gserviceaccount.com
```

## 4. Set the credentials environment variable

Add to your shell profile (`~/.zshrc`, `~/.bashrc`, etc.):

```bash
export GOOGLE_APPLICATION_CREDENTIALS="$HOME/epub2mp3-key.json"
```

Or create a `.env` file in the project root:

```
GOOGLE_APPLICATION_CREDENTIALS=/path/to/epub2mp3-key.json
```

The CLI loads `.env` automatically via `dotenv`.

## 5. Verify

```bash
# Should print available voices without error
gcloud ml language text-to-speech voices list --filter="languageCode:uk-UA"
```

Or run epub2mp3 in dry-run mode (no TTS calls needed):

```bash
pnpm dev -- book.epub --lang uk --dry-run
```

## Free tier

Google Cloud TTS provides a generous free tier:

| Voice type | Free characters/month |
|------------|----------------------|
| Standard   | 4,000,000           |
| WaveNet    | 1,000,000           |
| Neural2    | 1,000,000           |

epub2mp3 uses **WaveNet** voices by default. A typical 500,000-character novel fits within the free tier.

After the free tier, WaveNet costs **$16 per 1M characters**.

Use `--dry-run` to check character count and estimated cost before converting.

## Available voices

### Ukrainian (`uk-UA`)

| Voice | Gender |
|-------|--------|
| `uk-UA-Wavenet-A` (default) | Female |
| `uk-UA-Standard-A` | Female |

### Russian (`ru-RU`)

| Voice | Gender |
|-------|--------|
| `ru-RU-Wavenet-A` | Female |
| `ru-RU-Wavenet-B` | Male |
| `ru-RU-Wavenet-C` | Female |
| `ru-RU-Wavenet-D` (default) | Male |
| `ru-RU-Wavenet-E` | Female |

### English (`en-US`)

| Voice | Gender |
|-------|--------|
| `en-US-Wavenet-A` | Male |
| `en-US-Wavenet-B` | Male |
| `en-US-Wavenet-C` | Female |
| `en-US-Wavenet-D` (default) | Male |
| `en-US-Wavenet-E` | Female |
| `en-US-Wavenet-F` | Female |

Full list: [cloud.google.com/text-to-speech/docs/voices](https://cloud.google.com/text-to-speech/docs/voices)

## Troubleshooting

### `Could not load the default credentials`

The `GOOGLE_APPLICATION_CREDENTIALS` env var is not set or points to a missing file.

```bash
echo $GOOGLE_APPLICATION_CREDENTIALS
ls -la $GOOGLE_APPLICATION_CREDENTIALS
```

### `Permission denied` / `403`

The service account needs the **Cloud Text-to-Speech User** role, or the API is not enabled.

```bash
gcloud services enable texttospeech.googleapis.com

gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:epub2mp3-tts@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/cloudtexttospeech.user"
```

### `429 Resource exhausted`

You've hit the rate limit or the free tier quota. The TTS engine retries 429 errors automatically with exponential backoff. To reduce pressure:

```bash
# Lower concurrency
pnpm dev -- book.epub --lang ru --concurrency 1
```
