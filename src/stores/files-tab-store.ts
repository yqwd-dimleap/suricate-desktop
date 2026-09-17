import { create } from "zustand";
import { setConversationState } from "#/utils/conversation-local-storage";
import type { FileRevealRange } from "#/utils/file-reveal-range";
import { normalizeFileRevealRange } from "#/utils/file-reveal-range";

export type PendingFileReveal = {
  path: string;
  startLine: number;
  endLine: number;
  /** Bumps on every reveal so re-clicking the same range re-triggers scroll. */
  nonce: number;
};

type StickyRevealRange = {
  startLine: number;
  endLine: number;
  nonce: number;
};

interface FilesTabState {
  selectedPath: string | null;
  // The conversation a selection belongs to. A file picked in one
  // conversation must not leak into another (it usually doesn't exist in the
  // other conversation's workspace, see issue #1350), so every selection is
  // tagged with its conversation and the files tab ignores a path owned by a
  // different conversation.
  selectedConversationId: string | null;
  /**
   * Ordered list of files the user or agent has opened in the current
   * conversation. The quick-row tab strip renders only these paths.
   */
  openPaths: string[];
  /**
   * Persistent line highlights keyed by Files-tab path. Survive until Keep /
   * Revert or the path is no longer dirty vs HEAD (committed / pushed clean).
   */
  stickyReveals: Record<string, StickyRevealRange>;
  /**
   * Session-only Git Blame annotate mode for the Files Monaco editor.
   * Toggled from the editor context menu (Annotate with Git Blame /
   * Close Annotations). Not persisted.
   */
  isAnnotateEnabled: boolean;
  /**
   * True once `/api/git/blame` 404'd for this session (old agent-server).
   * Hides the Annotate context-menu actions.
   */
  isAnnotateUnsupported: boolean;
  setSelectedPath: (
    path: string | null,
    conversationId?: string | null,
    options?: { reveal?: FileRevealRange | null },
  ) => void;
  /** Register or refresh a sticky highlight without changing selection. */
  setStickyReveal: (path: string, reveal: FileRevealRange) => void;
  clearStickyReveal: (path: string) => void;
  clearAllStickyReveals: () => void;
  setAnnotateEnabled: (enabled: boolean) => void;
  setAnnotateUnsupported: (unsupported: boolean) => void;
  /** Remove a path from the open-tab strip; selects a neighbor when needed. */
  closeOpenPath: (path: string) => void;
  /**
   * Replace in-memory open-tab state for a conversation (used when mounting
   * / switching conversations so a refresh can restore localStorage).
   * Does not write back to localStorage.
   */
  hydrateForConversation: (
    conversationId: string,
    openPaths: string[],
    selectedPath: string | null,
  ) => void;
}

function withOpenedPath(
  openPaths: string[],
  path: string,
  sameConversation: boolean,
): string[] {
  if (!sameConversation) return [path];
  if (openPaths.includes(path)) return openPaths;
  return [...openPaths, path];
}

function selectNeighborAfterClose(
  openPaths: string[],
  closedPath: string,
  selectedPath: string | null,
): string | null {
  if (selectedPath !== closedPath) return selectedPath;
  const closedIndex = openPaths.indexOf(closedPath);
  const remaining = openPaths.filter((path) => path !== closedPath);
  if (remaining.length === 0) return null;
  // Prefer the tab that slides into the closed slot (right neighbor), else left.
  return remaining[Math.min(closedIndex, remaining.length - 1)] ?? null;
}

function resolveSelectedPath(
  openPaths: string[],
  selectedPath: string | null,
): string | null {
  if (selectedPath && openPaths.includes(selectedPath)) return selectedPath;
  return null;
}

function persistOpenState(
  conversationId: string | null | undefined,
  openPaths: string[],
  selectedPath: string | null,
) {
  if (!conversationId) return;
  setConversationState(conversationId, {
    filesTabOpenPaths: openPaths,
    filesTabSelectedPath: selectedPath,
  });
}

function upsertStickyReveal(
  stickyReveals: Record<string, StickyRevealRange>,
  path: string,
  reveal: FileRevealRange,
): Record<string, StickyRevealRange> {
  const normalized = normalizeFileRevealRange(reveal);
  const previous = stickyReveals[path];
  return {
    ...stickyReveals,
    [path]: {
      startLine: normalized.startLine,
      endLine: normalized.endLine,
      nonce: (previous?.nonce ?? 0) + 1,
    },
  };
}

// Hoisted out of files-tab.tsx local state so non-React callers (e.g. the
// canvas_ui tool dispatcher in the WebSocket context) can drive selection.
export const useFilesTabStore = create<FilesTabState>((set) => ({
  selectedPath: null,
  selectedConversationId: null,
  openPaths: [],
  stickyReveals: {},
  isAnnotateEnabled: false,
  isAnnotateUnsupported: false,
  setSelectedPath: (selectedPath, conversationId = null, options) =>
    set((state) => {
      if (selectedPath === null) {
        const switchedConversation =
          conversationId !== state.selectedConversationId;
        const next = {
          selectedPath: null as string | null,
          selectedConversationId: conversationId,
          // Drop open tabs when the active conversation changes so paths
          // from conversation A never appear as tabs in conversation B.
          // Callers that switch conversations should prefer
          // `hydrateForConversation` so persisted tabs can be restored.
          openPaths: switchedConversation ? [] : state.openPaths,
          stickyReveals: switchedConversation
            ? ({} as Record<string, StickyRevealRange>)
            : state.stickyReveals,
        };
        persistOpenState(conversationId, next.openPaths, next.selectedPath);
        return next;
      }

      const sameConversation = state.selectedConversationId === conversationId;
      const stickyReveals = options?.reveal
        ? upsertStickyReveal(state.stickyReveals, selectedPath, options.reveal)
        : sameConversation
          ? state.stickyReveals
          : ({} as Record<string, StickyRevealRange>);
      const next = {
        selectedPath,
        selectedConversationId: conversationId,
        openPaths: withOpenedPath(
          state.openPaths,
          selectedPath,
          sameConversation,
        ),
        stickyReveals,
      };
      persistOpenState(conversationId, next.openPaths, next.selectedPath);
      return next;
    }),
  setStickyReveal: (path, reveal) =>
    set((state) => ({
      stickyReveals: upsertStickyReveal(state.stickyReveals, path, reveal),
    })),
  clearStickyReveal: (path) =>
    set((state) => {
      if (!(path in state.stickyReveals)) return state;
      const stickyReveals = { ...state.stickyReveals };
      delete stickyReveals[path];
      return { stickyReveals };
    }),
  clearAllStickyReveals: () => set({ stickyReveals: {} }),
  setAnnotateEnabled: (isAnnotateEnabled) => set({ isAnnotateEnabled }),
  setAnnotateUnsupported: (isAnnotateUnsupported) =>
    set({
      isAnnotateUnsupported,
      ...(isAnnotateUnsupported ? { isAnnotateEnabled: false } : {}),
    }),
  closeOpenPath: (path) =>
    set((state) => {
      if (!state.openPaths.includes(path)) return state;
      const selectedPath = selectNeighborAfterClose(
        state.openPaths,
        path,
        state.selectedPath,
      );
      const stickyReveals = { ...state.stickyReveals };
      delete stickyReveals[path];
      const next = {
        openPaths: state.openPaths.filter((openPath) => openPath !== path),
        selectedPath,
        stickyReveals,
      };
      persistOpenState(
        state.selectedConversationId,
        next.openPaths,
        next.selectedPath,
      );
      return next;
    }),
  hydrateForConversation: (conversationId, openPaths, selectedPath) =>
    set({
      selectedConversationId: conversationId,
      openPaths,
      selectedPath: resolveSelectedPath(openPaths, selectedPath),
      stickyReveals: {},
    }),
}));
