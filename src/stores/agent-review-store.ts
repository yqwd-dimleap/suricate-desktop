import { create } from "zustand";
import {
  computeAgentReviewHunks,
  type AgentReviewHunk,
} from "#/utils/agent-review-hunks";

export type AgentReviewHunkStatus = "pending" | "accepted" | "rejected";

export type PendingReviewHunk = AgentReviewHunk & {
  status: AgentReviewHunkStatus;
};

export type PendingReviewFile = {
  path: string;
  baseline: string;
  current: string;
  prevExist: boolean;
  hunks: PendingReviewHunk[];
};

export type AgentReviewCheckpoint = {
  id: string;
  files: Record<string, { baseline: string; prevExist: boolean }>;
};

type ConversationReview = {
  activeCheckpointId: string | null;
  checkpoints: Record<string, AgentReviewCheckpoint>;
  pending: Record<string, PendingReviewFile>;
};

export type IngestObservationInput = {
  conversationId: string;
  checkpointId: string;
  path: string;
  baseline: string;
  current: string;
  prevExist: boolean;
};

type AgentReviewState = {
  byConversation: Record<string, ConversationReview>;
  reset: () => void;
  openCheckpoint: (conversationId: string, checkpointId: string) => void;
  ingestObservation: (input: IngestObservationInput) => void;
  acceptHunk: (conversationId: string, path: string, hunkId: string) => void;
  setFileCurrent: (
    conversationId: string,
    path: string,
    current: string,
  ) => void;
  acceptAllInFile: (conversationId: string, path: string) => void;
  acceptAll: (conversationId: string) => void;
  clearFile: (conversationId: string, path: string) => void;
  clearAllPending: (conversationId: string) => void;
  getCheckpoint: (
    conversationId: string,
    checkpointId: string,
  ) => AgentReviewCheckpoint | undefined;
  getPendingFile: (
    conversationId: string,
    path: string,
  ) => PendingReviewFile | undefined;
  getPendingFiles: (conversationId: string) => PendingReviewFile[];
};

function emptyConversation(): ConversationReview {
  return {
    activeCheckpointId: null,
    checkpoints: {},
    pending: {},
  };
}

function withHunks(file: Omit<PendingReviewFile, "hunks">): PendingReviewFile {
  return {
    ...file,
    hunks: computeAgentReviewHunks(file.baseline, file.current).map((hunk) => ({
      ...hunk,
      status: "pending" as const,
    })),
  };
}

function dropIfNoPending(
  pending: Record<string, PendingReviewFile>,
  path: string,
  file: PendingReviewFile,
): Record<string, PendingReviewFile> {
  const next = { ...pending };
  if (!file.hunks.some((hunk) => hunk.status === "pending")) {
    delete next[path];
  } else {
    next[path] = file;
  }
  return next;
}

export const useAgentReviewStore = create<AgentReviewState>((set, get) => ({
  byConversation: {},
  reset: () => set({ byConversation: {} }),
  openCheckpoint: (conversationId, checkpointId) =>
    set((state) => {
      const current =
        state.byConversation[conversationId] ?? emptyConversation();
      const checkpoints = current.checkpoints[checkpointId]
        ? current.checkpoints
        : {
            ...current.checkpoints,
            [checkpointId]: { id: checkpointId, files: {} },
          };
      return {
        byConversation: {
          ...state.byConversation,
          [conversationId]: {
            ...current,
            activeCheckpointId: checkpointId,
            checkpoints,
          },
        },
      };
    }),
  ingestObservation: (input) =>
    set((state) => {
      const current =
        state.byConversation[input.conversationId] ?? emptyConversation();
      const checkpointId = input.checkpointId;
      const existingCheckpoint = current.checkpoints[checkpointId] ?? {
        id: checkpointId,
        files: {},
      };
      const snapshot = existingCheckpoint.files[input.path];
      const files = snapshot
        ? existingCheckpoint.files
        : {
            ...existingCheckpoint.files,
            [input.path]: {
              baseline: input.baseline,
              prevExist: input.prevExist,
            },
          };
      const baseline = files[input.path]?.baseline ?? input.baseline;
      const prevExist = files[input.path]?.prevExist ?? input.prevExist;
      const pendingFile = withHunks({
        path: input.path,
        baseline,
        current: input.current,
        prevExist,
      });
      const pending = { ...current.pending };
      if (!pendingFile.hunks.some((hunk) => hunk.status === "pending")) {
        delete pending[input.path];
      } else {
        pending[input.path] = pendingFile;
      }
      return {
        byConversation: {
          ...state.byConversation,
          [input.conversationId]: {
            ...current,
            activeCheckpointId: checkpointId,
            checkpoints: {
              ...current.checkpoints,
              [checkpointId]: { id: checkpointId, files },
            },
            pending,
          },
        },
      };
    }),
  acceptHunk: (conversationId, path, hunkId) =>
    set((state) => {
      const current = state.byConversation[conversationId];
      const file = current?.pending[path];
      if (!current || !file) {
        return state;
      }
      const nextFile: PendingReviewFile = {
        ...file,
        hunks: file.hunks.map((hunk) =>
          hunk.id === hunkId ? { ...hunk, status: "accepted" as const } : hunk,
        ),
      };
      return {
        byConversation: {
          ...state.byConversation,
          [conversationId]: {
            ...current,
            pending: dropIfNoPending(current.pending, path, nextFile),
          },
        },
      };
    }),
  setFileCurrent: (conversationId, path, currentText) =>
    set((state) => {
      const current = state.byConversation[conversationId];
      const file = current?.pending[path];
      if (!current || !file) {
        return state;
      }
      const nextFile = withHunks({
        path: file.path,
        baseline: file.baseline,
        current: currentText,
        prevExist: file.prevExist,
      });
      const pending = { ...current.pending };
      if (!nextFile.hunks.some((hunk) => hunk.status === "pending")) {
        delete pending[path];
      } else {
        pending[path] = nextFile;
      }
      return {
        byConversation: {
          ...state.byConversation,
          [conversationId]: { ...current, pending },
        },
      };
    }),
  acceptAllInFile: (conversationId, path) =>
    get().clearFile(conversationId, path),
  acceptAll: (conversationId) => get().clearAllPending(conversationId),
  clearFile: (conversationId, path) =>
    set((state) => {
      const current = state.byConversation[conversationId];
      if (!current || !(path in current.pending)) {
        return state;
      }
      const pending = { ...current.pending };
      delete pending[path];
      return {
        byConversation: {
          ...state.byConversation,
          [conversationId]: { ...current, pending },
        },
      };
    }),
  clearAllPending: (conversationId) =>
    set((state) => {
      const current = state.byConversation[conversationId];
      if (!current) {
        return state;
      }
      return {
        byConversation: {
          ...state.byConversation,
          [conversationId]: { ...current, pending: {} },
        },
      };
    }),
  getCheckpoint: (conversationId, checkpointId) =>
    get().byConversation[conversationId]?.checkpoints[checkpointId],
  getPendingFile: (conversationId, path) =>
    get().byConversation[conversationId]?.pending[path],
  getPendingFiles: (conversationId) => {
    const pending = get().byConversation[conversationId]?.pending ?? {};
    return Object.values(pending).filter((file) =>
      file.hunks.some((hunk) => hunk.status === "pending"),
    );
  },
}));
