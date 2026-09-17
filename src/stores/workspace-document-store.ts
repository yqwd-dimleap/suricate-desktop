import { create } from "zustand";

export type WorkspaceDocument = {
  /** Last known contents on disk (loaded, saved, or accepted remote). */
  baseline: string;
  /** Editor buffer. */
  draft: string;
  /**
   * Disk contents that diverged while `draft !== baseline`. Null when
   * there is no unresolved conflict.
   */
  incoming: string | null;
};

type ConversationDocuments = Record<string, WorkspaceDocument>;

type WorkspaceDocumentState = {
  byConversation: Record<string, ConversationDocuments>;
  reset: () => void;
  /**
   * Fold a freshly fetched disk snapshot into the open buffer.
   * Clean buffers follow remote; dirty buffers keep the draft and
   * record `incoming` when remote diverged.
   */
  applyRemote: (
    conversationId: string,
    path: string,
    remoteText: string,
  ) => void;
  setDraft: (conversationId: string, path: string, draft: string) => void;
  /** After a successful save: disk and buffer match `content`. */
  markSynced: (conversationId: string, path: string, content: string) => void;
  keepMine: (conversationId: string, path: string) => void;
  useIncoming: (conversationId: string, path: string) => void;
  /** Drop a clean buffer; keep dirty / conflicted buffers so reopen restores. */
  closePath: (conversationId: string, path: string) => void;
  clearConversation: (conversationId: string) => void;
  getDocument: (
    conversationId: string,
    path: string,
  ) => WorkspaceDocument | undefined;
};

export function isDocumentDirty(doc: WorkspaceDocument | undefined): boolean {
  return !!doc && doc.draft !== doc.baseline;
}

export function hasDocumentConflict(
  doc: WorkspaceDocument | undefined,
): boolean {
  return !!doc && doc.incoming !== null;
}

function setPath(
  state: WorkspaceDocumentState,
  conversationId: string,
  path: string,
  next: WorkspaceDocument | undefined,
): WorkspaceDocumentState {
  const current = state.byConversation[conversationId] ?? {};
  if (next === undefined) {
    if (!(path in current)) {
      return state;
    }
    const rest = { ...current };
    delete rest[path];
    const byConversation = { ...state.byConversation };
    if (Object.keys(rest).length === 0) {
      delete byConversation[conversationId];
    } else {
      byConversation[conversationId] = rest;
    }
    return { ...state, byConversation };
  }
  return {
    ...state,
    byConversation: {
      ...state.byConversation,
      [conversationId]: {
        ...current,
        [path]: next,
      },
    },
  };
}

export const useWorkspaceDocumentStore = create<WorkspaceDocumentState>(
  (set, get) => ({
    byConversation: {},
    reset: () => set({ byConversation: {} }),
    applyRemote: (conversationId, path, remoteText) =>
      set((state) => {
        const current = state.byConversation[conversationId]?.[path];
        if (!current) {
          return setPath(state, conversationId, path, {
            baseline: remoteText,
            draft: remoteText,
            incoming: null,
          });
        }
        const dirty = current.draft !== current.baseline;
        if (!dirty) {
          if (current.baseline === remoteText && current.incoming === null) {
            return state;
          }
          return setPath(state, conversationId, path, {
            baseline: remoteText,
            draft: remoteText,
            incoming: null,
          });
        }
        if (remoteText === current.draft) {
          if (current.baseline === remoteText && current.incoming === null) {
            return state;
          }
          return setPath(state, conversationId, path, {
            ...current,
            baseline: remoteText,
            incoming: null,
          });
        }
        if (remoteText === current.baseline) {
          return state;
        }
        if (current.incoming === remoteText) {
          return state;
        }
        return setPath(state, conversationId, path, {
          ...current,
          incoming: remoteText,
        });
      }),
    setDraft: (conversationId, path, draft) =>
      set((state) => {
        const current = state.byConversation[conversationId]?.[path];
        if (!current || current.draft === draft) {
          return state;
        }
        if (current.incoming !== null && draft === current.incoming) {
          return setPath(state, conversationId, path, {
            baseline: draft,
            draft,
            incoming: null,
          });
        }
        return setPath(state, conversationId, path, { ...current, draft });
      }),
    markSynced: (conversationId, path, content) =>
      set((state) =>
        setPath(state, conversationId, path, {
          baseline: content,
          draft: content,
          incoming: null,
        }),
      ),
    keepMine: (conversationId, path) =>
      set((state) => {
        const current = state.byConversation[conversationId]?.[path];
        if (current?.incoming == null) {
          return state;
        }
        return setPath(state, conversationId, path, {
          baseline: current.incoming,
          draft: current.draft,
          incoming: null,
        });
      }),
    useIncoming: (conversationId, path) =>
      set((state) => {
        const current = state.byConversation[conversationId]?.[path];
        if (current?.incoming == null) {
          return state;
        }
        return setPath(state, conversationId, path, {
          baseline: current.incoming,
          draft: current.incoming,
          incoming: null,
        });
      }),
    closePath: (conversationId, path) =>
      set((state) => {
        const current = state.byConversation[conversationId]?.[path];
        if (!current) {
          return state;
        }
        if (current.draft !== current.baseline || current.incoming !== null) {
          return state;
        }
        return setPath(state, conversationId, path, undefined);
      }),
    clearConversation: (conversationId) =>
      set((state) => {
        if (!(conversationId in state.byConversation)) {
          return state;
        }
        const byConversation = { ...state.byConversation };
        delete byConversation[conversationId];
        return { ...state, byConversation };
      }),
    getDocument: (conversationId, path) =>
      get().byConversation[conversationId]?.[path],
  }),
);
