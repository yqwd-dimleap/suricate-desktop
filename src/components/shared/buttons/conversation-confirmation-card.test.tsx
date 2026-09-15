import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ActionEvent } from "#/types/agent-server/core";
import type { ExecuteBashAction } from "#/types/agent-server/core/base/action";
import { SecurityRisk } from "#/types/agent-server/core/base/common";
import { useEventMessageStore } from "#/stores/event-message-store";
import { ConversationConfirmationCard } from "./conversation-confirmation-card";

const respondToConfirmationMock = vi.hoisted(() => vi.fn());
const displayErrorToastMock = vi.hoisted(() => vi.fn());
const activeConversationState = vi.hoisted(() => ({
  data: undefined as Record<string, unknown> | undefined,
}));

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("#/hooks/query/use-active-conversation", () => ({
  useActiveConversation: () => activeConversationState,
}));

vi.mock("#/api/event-service/event-service.api", () => ({
  default: { respondToConfirmation: respondToConfirmationMock },
}));

vi.mock("#/utils/custom-toast-handlers", () => ({
  displayErrorToast: displayErrorToastMock,
}));

const pendingAction: ActionEvent<ExecuteBashAction> = {
  id: "action-1",
  timestamp: "2026-07-10T12:34:56.000Z",
  source: "agent",
  thought: [],
  thinking_blocks: [],
  action: {
    kind: "ExecuteBashAction",
    command: "rm -rf build",
    is_input: false,
    timeout: null,
    reset: false,
  },
  tool_name: "terminal",
  tool_call_id: "tool-1",
  tool_call: {
    id: "tool-1",
    type: "function",
    function: { name: "terminal", arguments: "{}" },
  },
  llm_response_id: "response-1",
  security_risk: SecurityRisk.LOW,
  summary: "Remove the build directory",
};

const renderCard = (event: ActionEvent<ExecuteBashAction> = pendingAction) => {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ConversationConfirmationCard event={event} />
    </QueryClientProvider>,
  );
};

describe("ConversationConfirmationCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useEventMessageStore.setState({ submittedEventIds: [] });
    activeConversationState.data = {
      id: "conversation-1",
      conversation_url: "http://localhost:3000",
      session_api_key: null,
    };
  });

  it("shows the risk alert only for high-risk actions", () => {
    const { unmount } = renderCard({
      ...pendingAction,
      security_risk: SecurityRisk.HIGH,
    });
    expect(screen.getByText("COMMON$HIGH_RISK")).toBeInTheDocument();
    unmount();

    renderCard();
    expect(screen.queryByText("COMMON$HIGH_RISK")).not.toBeInTheDocument();
  });

  it("records the event id only after the request succeeds", async () => {
    let resolveRequest!: (value: unknown) => void;
    respondToConfirmationMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRequest = resolve;
        }),
    );

    renderCard();
    await userEvent.click(screen.getByTestId("action-confirm-button"));

    expect(respondToConfirmationMock).toHaveBeenCalledWith(
      "conversation-1",
      "http://localhost:3000",
      { accept: true },
      null,
    );
    // In flight: not yet recorded, both actions locked.
    expect(useEventMessageStore.getState().submittedEventIds).toEqual([]);
    expect(screen.getByTestId("action-confirm-button")).toBeDisabled();
    expect(screen.getByTestId("action-reject-button")).toBeDisabled();

    resolveRequest({});
    await waitFor(() =>
      expect(useEventMessageStore.getState().submittedEventIds).toEqual([
        "action-1",
      ]),
    );
  });

  it("ignores repeated clicks while a response is in flight", async () => {
    respondToConfirmationMock.mockImplementation(() => new Promise(() => {}));

    renderCard();
    const confirm = screen.getByTestId("action-confirm-button");
    await userEvent.click(confirm);
    await userEvent.click(confirm, { pointerEventsCheck: 0 });

    expect(respondToConfirmationMock).toHaveBeenCalledTimes(1);
  });

  it("stays interactive and reports the error when the request fails", async () => {
    respondToConfirmationMock.mockRejectedValue(new Error("network down"));

    renderCard();
    await userEvent.click(screen.getByTestId("action-reject-button"));

    await waitFor(() =>
      expect(displayErrorToastMock).toHaveBeenCalledWith("network down"),
    );
    // Failure keeps the card actionable: nothing recorded, buttons unlocked.
    expect(useEventMessageStore.getState().submittedEventIds).toEqual([]);
    await waitFor(() =>
      expect(screen.getByTestId("action-confirm-button")).toBeEnabled(),
    );

    respondToConfirmationMock.mockResolvedValue({});
    await userEvent.click(screen.getByTestId("action-confirm-button"));
    await waitFor(() =>
      expect(useEventMessageStore.getState().submittedEventIds).toEqual([
        "action-1",
      ]),
    );
  });

  it("submits via keyboard shortcuts", async () => {
    respondToConfirmationMock.mockResolvedValue({});

    renderCard();
    await userEvent.keyboard("{Meta>}{Enter}{/Meta}");

    await waitFor(() =>
      expect(respondToConfirmationMock).toHaveBeenCalledWith(
        "conversation-1",
        "http://localhost:3000",
        { accept: true },
        null,
      ),
    );
  });

  it("ignores near-miss shortcuts and stops listening after unmount", async () => {
    respondToConfirmationMock.mockResolvedValue({});

    const { unmount } = renderCard();
    // Shift+Backspace without Meta, and Shift+Meta+Escape: both near misses.
    await userEvent.keyboard("{Shift>}{Backspace}{/Shift}");
    await userEvent.keyboard("{Shift>}{Meta>}{Escape}{/Meta}{/Shift}");
    expect(respondToConfirmationMock).not.toHaveBeenCalled();

    unmount();
    await userEvent.keyboard("{Meta>}{Enter}{/Meta}");
    expect(respondToConfirmationMock).not.toHaveBeenCalled();
  });

  it("does not submit without active conversation metadata", async () => {
    activeConversationState.data = undefined;

    renderCard();
    await userEvent.click(screen.getByTestId("action-confirm-button"));

    expect(respondToConfirmationMock).not.toHaveBeenCalled();
    expect(useEventMessageStore.getState().submittedEventIds).toEqual([]);
  });
});
