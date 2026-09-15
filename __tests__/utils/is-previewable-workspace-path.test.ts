import { describe, expect, it } from "vitest";
import { isPreviewableWorkspacePath } from "#/utils/is-previewable-workspace-path";

describe("isPreviewableWorkspacePath", () => {
  it.each([
    "index.html",
    "docs/readme.md",
    "chart.svg",
    "report.pdf",
    "assets/logo.png",
  ])("treats %s as previewable", (path) => {
    expect(isPreviewableWorkspacePath(path)).toBe(true);
  });

  it.each(["src/app.ts", "main.py", "Cargo.toml", "notes.txt"])(
    "keeps %s on the Files tab",
    (path) => {
      expect(isPreviewableWorkspacePath(path)).toBe(false);
    },
  );
});
