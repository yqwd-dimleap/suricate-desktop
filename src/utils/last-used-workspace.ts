/**
 * Persist the last local workspace the user launched a conversation with.
 * Used to auto-attach that path on later "new conversation" flows when the
 * user does not explicitly pick "No workspace".
 */

export const LAST_USED_WORKSPACE_PATH_KEY =
  "openhands-last-used-workspace-path";

/** Legacy home-form key (session-scoped); still read as a one-shot fallback. */
export const HOME_SELECTED_WORKSPACE_PATH_KEY =
  "oh:home-selected-workspace-path";

function readStorage(storage: Storage, key: string): string | null {
  try {
    const path = storage.getItem(key);
    return path && path.length > 0 ? path : null;
  } catch {
    return null;
  }
}

function writeStorage(
  storage: Storage,
  key: string,
  path: string | null,
): void {
  try {
    if (path) {
      storage.setItem(key, path);
    } else {
      storage.removeItem(key);
    }
  } catch {
    // Ignore quota / private-mode failures.
  }
}

export function readLastUsedWorkspacePath(): string | null {
  if (typeof window === "undefined") return null;

  const durable = readStorage(
    window.localStorage,
    LAST_USED_WORKSPACE_PATH_KEY,
  );
  if (durable) return durable;

  // Fall back to the home form's session selection so a first launch in the
  // same tab still auto-attaches after we promote to localStorage.
  return readStorage(window.sessionStorage, HOME_SELECTED_WORKSPACE_PATH_KEY);
}

export function writeLastUsedWorkspacePath(path: string | null): void {
  if (typeof window === "undefined") return;

  writeStorage(window.localStorage, LAST_USED_WORKSPACE_PATH_KEY, path);
  writeStorage(window.sessionStorage, HOME_SELECTED_WORKSPACE_PATH_KEY, path);
}
