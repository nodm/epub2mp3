import { describe, expect, it } from "vitest";
import { textToSsml } from "../src/ssml.js";

describe("textToSsml", () => {
  describe("XML escaping", () => {
    it("escapes ampersands and angle brackets", () => {
      expect(textToSsml("A & B < C > D", "en")).toBe("<speak>A &amp; B &lt; C &gt; D</speak>");
    });

    it("escapes quotes", () => {
      expect(textToSsml(`He said "hello" & 'bye'`, "en")).toBe(
        "<speak>He said &quot;hello&quot; &amp; &apos;bye&apos;</speak>",
      );
    });
  });

  describe("Russian interjections — substitutions", () => {
    it("replaces Хм... with sub tag", () => {
      const result = textToSsml("Хм... ладно.", "ru");
      expect(result).toContain('<sub alias="хмм">');
      expect(result).toContain("</sub>");
      expect(result).toContain("ладно.");
    });

    it("replaces Гм with sub tag", () => {
      const result = textToSsml("Гм, интересно.", "ru");
      expect(result).toContain('<sub alias="гмм">');
    });

    it("replaces М-м with sub tag", () => {
      const result = textToSsml("М-м, не знаю.", "ru");
      expect(result).toContain('<sub alias="ммм">');
    });

    it("replaces Э-э with sub tag", () => {
      const result = textToSsml("Э-э, подожди.", "ru");
      expect(result).toContain('<sub alias="эээ">');
    });

    it("replaces Хе-хе with sub tag", () => {
      const result = textToSsml("Хе-хе, смешно.", "ru");
      expect(result).toContain('<sub alias="хе хе">');
    });

    it("handles case-insensitive match", () => {
      const result = textToSsml("хм... ладно.", "ru");
      expect(result).toContain('<sub alias="хмм">');
    });
  });

  describe("Russian interjections — breaks", () => {
    it("replaces Тсс with break", () => {
      const result = textToSsml("Тсс, тихо!", "ru");
      expect(result).toContain('<break time="400ms"/>');
      expect(result).not.toContain("Тсс");
    });

    it("replaces Пф with break", () => {
      const result = textToSsml("Пф, ерунда.", "ru");
      expect(result).toContain('<break time="300ms"/>');
    });

    it("replaces Тьфу with break", () => {
      const result = textToSsml("Тьфу! Гадость.", "ru");
      expect(result).toContain('<break time="300ms"/>');
    });
  });

  describe("punctuation markup", () => {
    it("converts ellipsis to break", () => {
      const result = textToSsml("Он ушёл... навсегда.", "ru");
      expect(result).toContain('<break time="500ms"/>');
      expect(result).not.toContain("...");
    });

    it("converts unicode ellipsis to break", () => {
      const result = textToSsml("Он ушёл\u2026 навсегда.", "ru");
      expect(result).toContain('<break time="500ms"/>');
    });

    it("converts em-dash to break", () => {
      const result = textToSsml("Он — герой.", "ru");
      expect(result).toContain('<break time="300ms"/>');
    });

    it("collapses multiple punctuation marks", () => {
      const result = textToSsml("Что?!!", "ru");
      expect(result).not.toContain("?!!");
    });
  });

  describe("no rules for other languages (yet)", () => {
    it("still wraps in speak tags and escapes for English", () => {
      expect(textToSsml("Hello & world", "en")).toBe("<speak>Hello &amp; world</speak>");
    });
  });

  describe("combined", () => {
    it("handles interjections + punctuation + escaping together", () => {
      const result = textToSsml("Хм... А & Б — друзья.", "ru");
      expect(result).toContain('<sub alias="хмм">');
      expect(result).toContain("&amp;");
      expect(result).toContain('<break time="300ms"/>');
      expect(result).toMatch(/^<speak>.*<\/speak>$/);
    });
  });
});
