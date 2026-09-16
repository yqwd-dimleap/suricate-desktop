import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

import { useAgentReviewActions } from "#/hooks/mutation/use-agent-review-actions";
import { useAgentReviewStore } from "#/stores/agent-review-store";

const saveMock = vi.fn();

vi.mock("#/hooks/use-conversation-id", () => ({
  useOptionalConversationId: () => ({ conversationId: "conv-1" }),
  useConversationId: () => ({ conversationId: "conv-1" }),
}));

vi.mock("#/hooks/query/use-active-conversation", () => ({
  useActiveConversation: () => ({
    data: {
      id: "conv-1",
      workspace: { working_dir: "/workspace" },
    },
  }),
}));

vi.mock("#/api/workspace-file-save.api", () => ({
  saveWorkspaceTextFile: (...args: unknown[]) => saveMock(...args),
}));

function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={new QueryClient()}>
      {children}
    </QueryClientProvider>
  );
}

describe("useAgentReviewActions", () => {
  beforeEach(() => {
    saveMock.mockReset();
    saveMock.mockResolvedValue(undefined);
    useAgentReviewStore.getState().reset();
    useAgentReviewStore.getState().openCheckpoint("conv-1", "msg-1");
    useAgentReviewStore.getState().ingestObservation({
      conversationId: "conv-1",
      checkpointId: "msg-1",
      path: "app.ts",
      baseline: "a\nOLD\nc",
      current: "a\nNEW\nc",
      prevExist: true,
    });
  });

  it("writes reconstructed text when rejecting a hunk", async () => {
    const { result } = renderHook(() => useAgentReviewActions(), { wrapper });
    const hunkId = useAgentReviewStore
      .getState()
      .getPendingFile("conv-1", "app.ts")?.hunks[0]?.id;
    expect(hunkId).toBeDefined();

    await act(async () => {
      await result.current.rejectHunk("app.ts", hunkId!);
    });

    expect(saveMock).toHaveBeenCalledWith(
      expect.objectContaining({
        relativePath: "app.ts",
        content: "a\nOLD\nc",
      }),
    );
    expect(
      useAgentReviewStore.getState().getPendingFile("conv-1", "app.ts"),
    ).toBeUndefined();
  });

  it("does not write when the file has unsaved editor edits", async () => {
    const { result } = renderHook(() => useAgentReviewActions(), { wrapper });
    const hunkId = useAgentReviewStore
      .getState()
      .getPendingFile("conv-1", "app.ts")?.hunks[0]?.id;

    await act(async () => {
      await result.current.rejectHunk("app.ts", hunkId!, true);
    });

    expect(saveMock).not.toHaveBeenCalled();
  });
});
