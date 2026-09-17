import { afterEach, describe, expect, it } from "vitest";
import {
  HOME_SELECTED_WORKSPACE_PATH_KEY,
  LAST_USED_WORKSPACE_PATH_KEY,
  readLastUsedWorkspacePath,
  writeLastUsedWorkspacePath,
} from "#/utils/last-used-workspace";

describe("last-used-workspace", () => {
  afterEach(() => {
    window.localStorage.removeItem(LAST_USED_WORKSPACE_PATH_KEY);
    window.sessionStorage.removeItem(HOME_SELECTED_WORKSPACE_PATH_KEY);
  });

  it("reads and writes a durable last-used path", () => {
    writeLastUsedWorkspacePath("/Users/me/dev/repo");

    expect(readLastUsedWorkspacePath()).toBe("/Users/me/dev/repo");
    expect(window.localStorage.getItem(LAST_USED_WORKSPACE_PATH_KEY)).toBe(
      "/Users/me/dev/repo",
    );
    expect(window.sessionStorage.getItem(HOME_SELECTED_WORKSPACE_PATH_KEY)).toBe(
      "/Users/me/dev/repo",
    );
  });

  it("falls back to the home-form session key when durable storage is empty", () => {
    window.sessionStorage.setItem(
      HOME_SELECTED_WORKSPACE_PATH_KEY,
      "/Users/me/dev/legacy",
    );

    expect(readLastUsedWorkspacePath()).toBe("/Users/me/dev/legacy");
  });

  it("clears both storages when path is null", () => {
    writeLastUsedWorkspacePath("/Users/me/dev/repo");
    writeLastUsedWorkspacePath(null);

    expect(readLastUsedWorkspacePath()).toBeNull();
    expect(window.localStorage.getItem(LAST_USED_WORKSPACE_PATH_KEY)).toBeNull();
    expect(
      window.sessionStorage.getItem(HOME_SELECTED_WORKSPACE_PATH_KEY),
    ).toBeNull();
  });
});
