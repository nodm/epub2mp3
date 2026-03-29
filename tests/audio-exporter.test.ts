import { describe, expect, it } from "vitest";
import { slugify } from "../src/audio-exporter.js";

describe("slugify", () => {
  it("replaces spaces with underscores", () => {
    expect(slugify("Hello World")).toBe("Hello_World");
  });

  it("removes special characters", () => {
    expect(slugify("Book: A Story!")).toBe("Book_A_Story");
  });

  it("preserves Cyrillic characters", () => {
    expect(slugify("Тестовая книга")).toBe("Тестовая_книга");
  });

  it("preserves Ukrainian characters", () => {
    expect(slugify("Привіт світе")).toBe("Привіт_світе");
  });

  it("preserves hyphens", () => {
    expect(slugify("my-book")).toBe("my-book");
  });

  it("truncates to 100 characters", () => {
    const long = "a".repeat(150);
    expect(slugify(long).length).toBe(100);
  });

  it("handles multiple spaces", () => {
    expect(slugify("hello   world")).toBe("hello_world");
  });
});
