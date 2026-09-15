import { describe, expect, it } from "vitest";
import {
  normalizeFileRevealRange,
  parsePathWithReveal,
  parseRevealRangeString,
} from "#/utils/file-reveal-range";

describe("file-reveal-range", () => {
  it("parses path:line and path:start-end", () => {
    expect(parsePathWithReveal("src/app.ts:12")).toEqual({
      path: "src/app.ts",
      reveal: { startLine: 12, endLine: 12 },
    });
    expect(parsePathWithReveal("src/app.ts:10-20")).toEqual({
      path: "src/app.ts",
      reveal: { startLine: 10, endLine: 20 },
    });
    expect(parsePathWithReveal("src/app.ts")).toEqual({ path: "src/app.ts" });
  });

  it("parses range display strings", () => {
    expect(parseRevealRangeString("7")).toEqual({
      startLine: 7,
      endLine: 7,
    });
    expect(parseRevealRangeString("7-9")).toEqual({
      startLine: 7,
      endLine: 9,
    });
    expect(parseRevealRangeString(undefined)).toBeUndefined();
  });

  it("normalizes inverted ranges", () => {
    expect(normalizeFileRevealRange({ startLine: 20, endLine: 10 })).toEqual({
      startLine: 10,
      endLine: 20,
    });
  });
});
