import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import React from "react";

import { useSyncAgentReviewFromEvents } from "#/hooks/use-sync-agent-review-from-events";
import { useEventStore } from "#/stores/use-event-store";
import { useAgentReviewStore } from "#/stores/agent-review-store";
import type { OHEvent } from "#/stores/use-event-store";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

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

function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={new QueryClient()}>
      {children}
    </QueryClientProvider>
  );
}

function userMessage(id: string): OHEvent {
  return {
    id,
    timestamp: new Date().toISOString(),
    source: "user",
    llm_message: { role: "user", content: "edit the file" },
    activated_skills: [],
    extended_content: [],
  } as unknown as OHEvent;
}

function fileEditObservation(id: string): OHEvent {
  return {
    id,
    timestamp: new Date().toISOString(),
    source: "environment",
    observation: {
      kind: "FileEditorObservation",
      command: "str_replace",
      path: "/workspace/app.ts",
      old_content: "a\nOLD\nc",
      new_content: "a\nNEW\nc",
      prev_exist: true,
      output: "ok",
    },
  } as unknown as OHEvent;
}

describe("useSyncAgentReviewFromEvents", () => {
  beforeEach(() => {
    act(() => {
      useEventStore.getState().clearEvents();
      useAgentReviewStore.getState().reset();
    });
  });

  it("opens a checkpoint on a user message and upserts pending review from a mutating edit", () => {
    renderHook(() => useSyncAgentReviewFromEvents(), { wrapper });

    act(() => {
      useEventStore.getState().addEvent(userMessage("msg-1"));
      useEventStore.getState().addEvent(fileEditObservation("obs-1"));
    });

    const pending = useAgentReviewStore
      .getState()
      .getPendingFile("conv-1", "app.ts");
    expect(pending?.baseline).toBe("a\nOLD\nc");
    expect(pending?.current).toBe("a\nNEW\nc");
    expect(
      useAgentReviewStore.getState().getCheckpoint("conv-1", "msg-1")?.files[
        "app.ts"
      ]?.baseline,
    ).toBe("a\nOLD\nc");
  });

  it("does not ingest view observations", () => {
    renderHook(() => useSyncAgentReviewFromEvents(), { wrapper });

    act(() => {
      useEventStore.getState().addEvent(userMessage("msg-1"));
      useEventStore.getState().addEvent({
        id: "obs-view",
        timestamp: new Date().toISOString(),
        source: "environment",
        observation: {
          kind: "FileEditorObservation",
          command: "view",
          path: "/workspace/app.ts",
          old_content: null,
          new_content: null,
          output: "ok",
        },
      } as unknown as OHEvent);
    });

    expect(
      useAgentReviewStore.getState().getPendingFile("conv-1", "app.ts"),
    ).toBeUndefined();
  });
});
