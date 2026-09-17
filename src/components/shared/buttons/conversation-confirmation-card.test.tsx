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

  it("shows the pending action without requiring an expand click", () => {
    renderCard();

    expect(
      screen.getByTestId("conversation-confirmation-action"),
    ).toHaveTextContent("Remove the build directory");
    expect(
      screen.getByTestId("conversation-confirmation-action-details"),
    ).toBeInTheDocument();
  });

  it("hides immediately on confirm and keeps the id after success", async () => {
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
    // Optimistic hide: recorded before the server answers.
    expect(useEventMessageStore.getState().submittedEventIds).toEqual([
      "action-1",
    ]);

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
    // Card is optimistically hidden from the timeline via submittedEventIds;
    // a second click on the still-mounted node must not re-fire.
    await userEvent.click(confirm, { pointerEventsCheck: 0 });

    expect(respondToConfirmationMock).toHaveBeenCalledTimes(1);
  });

  it("restores the card and reports the error when the request fails", async () => {
    respondToConfirmationMock.mockRejectedValue(new Error("network down"));

    renderCard();
    await userEvent.click(screen.getByTestId("action-reject-button"));

    await waitFor(() =>
      expect(displayErrorToastMock).toHaveBeenCalledWith("network down"),
    );
    // Failure rolls back the optimistic hide so the strip can reappear.
    await waitFor(() =>
      expect(useEventMessageStore.getState().submittedEventIds).toEqual([]),
    );
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

  it("ignores clicks outside the card so accidental dismiss cannot reject", async () => {
    respondToConfirmationMock.mockResolvedValue({});

    renderCard();
    await userEvent.pointer({
      keys: "[MouseLeft]",
      target: document.body,
    });

    expect(respondToConfirmationMock).not.toHaveBeenCalled();
    expect(useEventMessageStore.getState().submittedEventIds).toEqual([]);
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
