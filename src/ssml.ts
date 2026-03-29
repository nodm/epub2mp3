import { SCENE_BREAK_MARKER } from "./text-cleaner.js";
import type { Language } from "./types.js";

/**
 * Hybrid interjection handling:
 * - `sub`: known interjections get SSML <sub> with a pronounceable alias
 * - `break`: unpronounceable sounds become a pause
 */
type InterjectionRule = {
  pattern: RegExp;
} & ({ action: "sub"; alias: string } | { action: "break"; timeMs: number });

// \b doesn't work with Cyrillic — use lookbehind for start-of-string or non-letter
const B = "(?<=^|[\\s,.!?;:\"'«»—–])";

const RUSSIAN_INTERJECTIONS: InterjectionRule[] = [
  // Substitutions — TTS can pronounce the alias naturally
  { pattern: new RegExp(`${B}[Хх]м+[.…!]*`, "gu"), action: "sub", alias: "хмм" },
  { pattern: new RegExp(`${B}[Гг]м+[.…!]*`, "gu"), action: "sub", alias: "гмм" },
  { pattern: new RegExp(`${B}[Мм]-м+[.…!]*`, "gu"), action: "sub", alias: "ммм" },
  { pattern: new RegExp(`${B}[Ээ]-э+[.…!]*`, "gu"), action: "sub", alias: "эээ" },
  { pattern: new RegExp(`${B}[Хх]е-?хе[.…!]*`, "gu"), action: "sub", alias: "хе хе" },
  { pattern: new RegExp(`${B}[Хх]а-?ха[.…!]*`, "gu"), action: "sub", alias: "ха ха" },

  // Breaks — sounds that TTS can't pronounce, replace with pause
  { pattern: new RegExp(`${B}[Тт]сс+[.…!]*`, "gu"), action: "break", timeMs: 400 },
  { pattern: new RegExp(`${B}[Пп]ф+[.…!]*`, "gu"), action: "break", timeMs: 300 },
  { pattern: new RegExp(`${B}[Тт]ьфу[.…!]*`, "gu"), action: "break", timeMs: 300 },
];

const INTERJECTION_RULES: Record<Language, InterjectionRule[]> = {
  ru: RUSSIAN_INTERJECTIONS,
  uk: [], // TODO: add Ukrainian rules
  en: [], // TODO: add English rules
};

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Apply interjection rules to raw text (before XML escaping).
 * Returns text with SSML tags injected — surrounding text is NOT yet escaped.
 * We use a marker-based approach: replace interjections with SSML, then escape
 * only the non-SSML parts.
 */
function applyInterjections(text: string, lang: Language): string {
  const rules = INTERJECTION_RULES[lang];
  let result = text;

  for (const rule of rules) {
    if (rule.action === "sub") {
      result = result.replace(rule.pattern, (match) => `\x00SUB:${rule.alias}:${match}\x00`);
    } else {
      result = result.replace(rule.pattern, `\x00BREAK:${rule.timeMs}\x00`);
    }
  }

  return result;
}

/** Escape XML in plain-text segments, then resolve markers into SSML tags. */
function escapeAndResolveMarkers(text: string): string {
  const parts = text.split("\x00");
  return parts
    .map((part) => {
      if (part.startsWith("SUB:")) {
        const firstColon = part.indexOf(":", 4);
        const alias = part.slice(4, firstColon);
        const original = part.slice(firstColon + 1);
        return `<sub alias="${alias}">${escapeXml(original)}</sub>`;
      }
      if (part.startsWith("BREAK:")) {
        const timeMs = part.slice(6);
        return `<break time="${timeMs}ms"/>`;
      }
      return escapeXml(part);
    })
    .join("");
}

function applyPunctuationMarkup(text: string): string {
  return (
    text
      // Ellipsis → medium pause
      .replace(/[.…]{3,}/g, '<break time="500ms"/>')
      .replace(/…/g, '<break time="500ms"/>')
      // Em-dash / en-dash → short pause
      .replace(/\s*[—–]\s*/g, ' <break time="300ms"/> ')
      // Multiple exclamation/question marks → emphasis hint via prosody
      .replace(/([!?]){2,}/g, "$1")
  );
}

export function textToSsml(text: string, lang: Language): string {
  // Scene break → long pause, nothing else
  if (text === SCENE_BREAK_MARKER) {
    return '<speak><break time="1500ms"/></speak>';
  }
  // 1. Replace interjections with markers (on raw text, so patterns match)
  let ssml = applyInterjections(text, lang);
  // 2. Escape XML in plain-text segments, resolve markers into SSML tags
  ssml = escapeAndResolveMarkers(ssml);
  // 3. Add punctuation-driven pauses (operates on already-escaped text)
  ssml = applyPunctuationMarkup(ssml);
  return `<speak>${ssml}</speak>`;
}
