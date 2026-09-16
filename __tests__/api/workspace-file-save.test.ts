import { describe, expect, it } from "vitest";
import { normalizeWorkspaceRelativePath } from "#/api/workspace-file-save.api";

describe("normalizeWorkspaceRelativePath", () => {
  it("normalizes slashes and strips a leading slash", () => {
    expect(normalizeWorkspaceRelativePath("\\src\\foo.ts")).toBe("src/foo.ts");
    expect(normalizeWorkspaceRelativePath("/src/foo.ts")).toBe("src/foo.ts");
  });

  it("rejects empty paths and traversal segments", () => {
    expect(() => normalizeWorkspaceRelativePath("")).toThrow(
      "Invalid workspace path",
    );
    expect(() => normalizeWorkspaceRelativePath("../secret")).toThrow(
      "Invalid workspace path",
    );
    expect(() => normalizeWorkspaceRelativePath("src/../foo")).toThrow(
      "Invalid workspace path",
    );
  });
});
