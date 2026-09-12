import { describe, expect, it } from "vitest";
import { hasVisibleText, normalizeWhitespace } from "../src/core/text";

describe("text helpers", () => {
  it("detects visible text", () => {
    expect(hasVisibleText("abc")).toBe(true);
    expect(hasVisibleText("  \t \u00A0 ")).toBe(false);
    expect(hasVisibleText("")).toBe(false);
  });
  it("normalizes nbsp and repeated spaces", () => {
    expect(normalizeWhitespace("a\u00A0\u2007b")).toBe("a b");
    expect(normalizeWhitespace("  a   b  ")).toBe("a b");
  });
});
