import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSelectConversationTab } from "#/hooks/use-select-conversation-tab";
import { useConversationStore } from "#/stores/conversation-store";

vi.mock("#/hooks/use-conversation-id", () => ({
  useOptionalConversationId: () => ({ conversationId: "conv-1" }),
  useConversationId: () => ({ conversationId: "conv-1" }),
}));

vi.mock("#/hooks/query/use-active-conversation", () => ({
  useActiveConversation: () => ({
    data: { id: "conv-1", workspace: { working_dir: "/workspace/project" } },
  }),
}));

vi.mock("#/utils/conversation-local-storage", () => ({
  useConversationLocalStorageState: () => ({
    setSelectedTab: vi.fn(),
    setRightPanelShown: vi.fn(),
  }),
}));

describe("navigateToChanges", () => {
  beforeEach(() => {
    useConversationStore.setState({
      selectedTab: "files",
      isRightPanelShown: false,
      commitsAutoExpandPath: null,
      commitsAutoExpandSection: null,
    });
  });

  it("opens the Changes tab and records an optional auto-select path", () => {
    const { result } = renderHook(() => useSelectConversationTab());

    act(() => {
      result.current.navigateToChanges("src/foo.ts");
    });

    const state = useConversationStore.getState();
    expect(state.selectedTab).toBe("changes");
    expect(state.isRightPanelShown).toBe(true);
    expect(state.commitsAutoExpandPath).toBe("src/foo.ts");
  });
});
