import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "test-utils";
import { EventGroup } from "#/components/conversation-events/chat/event-message-components/event-group";
import {
  ActionEvent,
  ObservationEvent,
  SecurityRisk,
} from "#/types/agent-server/core";
import {
  ExecuteBashAction,
  FileEditorAction,
} from "#/types/agent-server/core/base/action";
import { ExecuteBashObservation } from "#/types/agent-server/core/base/observation";

const makeBashAction = (
  id: string,
  command: string,
): ActionEvent<ExecuteBashAction> => ({
  id,
  timestamp: new Date().toISOString(),
  source: "agent",
  thought: [],
  thinking_blocks: [],
  action: {
    kind: "ExecuteBashAction",
    command,
    is_input: false,
    timeout: null,
    reset: false,
  },
  tool_name: "execute_bash",
  tool_call_id: `call_${id}`,
  tool_call: {
    id: `call_${id}`,
    type: "function",
    function: {
      name: "execute_bash",
      arguments: JSON.stringify({ command }),
    },
  },
  llm_response_id: `response_${id}`,
  security_risk: SecurityRisk.UNKNOWN,
});

const makeBashObservation = (
  id: string,
  actionId: string,
  command: string,
): ObservationEvent<ExecuteBashObservation> => ({
  id,
  timestamp: new Date().toISOString(),
  source: "environment",
  tool_name: "execute_bash",
  tool_call_id: `call_${actionId}`,
  action_id: actionId,
  observation: {
    kind: "ExecuteBashObservation",
    content: [{ type: "text", text: "ok" }],
    command,
    exit_code: 0,
    error: false,
    timeout: false,
    metadata: {} as never,
  },
});

describe("EventGroup", () => {
  it("returns null for an empty events array", () => {
    const { container } = renderWithProviders(
      <EventGroup events={[]}>
        <div>child</div>
      </EventGroup>,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("renders a Cursor-style activity summary when all events are observations", () => {
    const events = [
      makeBashObservation("o1", "a1", "ls"),
      makeBashObservation("o2", "a2", "pwd"),
      makeBashObservation("o3", "a3", "whoami"),
    ];

    renderWithProviders(
      <EventGroup events={events}>
        <div data-testid="child">child content</div>
      </EventGroup>,
    );

    expect(screen.getByTestId("event-group-summary")).toHaveTextContent(
      "EVENT_GROUP$SUMMARY_COMMANDS",
    );
    // Children should not be visible in the collapsed state.
    expect(screen.queryByTestId("child")).not.toBeInTheDocument();
  });

  it("shows grouped children when defaultExpanded is set", () => {
    const events = [
      makeBashObservation("o1", "a1", "ls"),
      makeBashAction("a2", "kill 1"),
    ];

    renderWithProviders(
      <EventGroup events={events} defaultExpanded>
        <div data-testid="child">child content</div>
      </EventGroup>,
    );

    expect(screen.getByTestId("event-group-toggle")).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  it("renders a progress summary and the running action title while in flight", () => {
    const events = [
      makeBashObservation("o1", "a1", "ls"),
      makeBashObservation("o2", "a2", "pwd"),
      // Last action has NOT been replaced by an observation -> still running.
      makeBashAction("a3", "echo hello"),
    ];

    renderWithProviders(
      <EventGroup events={events}>
        <div>child</div>
      </EventGroup>,
    );

    expect(
      screen.getByText("EVENT_GROUP$ACTIONS_PROGRESS"),
    ).toBeInTheDocument();
    // The running action's title is rendered next to the summary. Translations
    // aren't loaded in tests, so we just verify the bash intent key shows up
    // (summarizeBashCommand maps echo → ACTION_MESSAGE$BASH_COMMAND).
    expect(
      screen.getByText("ACTION_MESSAGE$BASH_COMMAND"),
    ).toBeInTheDocument();
  });

  it("shows an activity summary instead of the latest title once idle", () => {
    // All observations -> nothing in flight: Cursor-style activity rollup.
    const events = [
      makeBashObservation("o1", "a1", "ls"),
      makeBashObservation("o2", "a2", "pwd"),
      makeBashObservation("o3", "a3", "whoami"),
    ];

    renderWithProviders(
      <EventGroup events={events}>
        <div>child</div>
      </EventGroup>,
    );

    expect(screen.getByTestId("event-group-summary")).toHaveTextContent(
      "EVENT_GROUP$SUMMARY_COMMANDS",
    );
    expect(
      screen.queryByText(/OBSERVATION_MESSAGE\$RUN/),
    ).not.toBeInTheDocument();
  });

  it("keeps the activity summary once the group is finalized", () => {
    const events = [
      makeBashObservation("o1", "a1", "ls"),
      makeBashObservation("o2", "a2", "pwd"),
      makeBashObservation("o3", "a3", "whoami"),
    ];

    renderWithProviders(
      <EventGroup events={events} isFinalized>
        <div>child</div>
      </EventGroup>,
    );

    expect(screen.getByTestId("event-group-summary")).toHaveTextContent(
      "EVENT_GROUP$SUMMARY_COMMANDS",
    );
    expect(
      screen.queryByText(/OBSERVATION_MESSAGE\$RUN/),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId("status-icon")).not.toBeInTheDocument();
  });

  it("joins file/search/command parts and shows aggregate +/-", () => {
    const fileObs: ObservationEvent = {
      id: "o-file",
      timestamp: new Date().toISOString(),
      source: "environment",
      tool_name: "file_editor",
      tool_call_id: "call_a-file",
      action_id: "a-file",
      observation: {
        kind: "FileEditorObservation",
        content: [],
        command: "str_replace",
        path: "/workspace/a.ts",
        old_content: "old\n",
        new_content: "new\n",
        prev_exist: true,
        output: "",
        error: null,
      },
    };
    const grepObs: ObservationEvent = {
      id: "o-grep",
      timestamp: new Date().toISOString(),
      source: "environment",
      tool_name: "grep",
      tool_call_id: "call_a-grep",
      action_id: "a-grep",
      observation: {
        kind: "GrepObservation",
        content: [],
        pattern: "foo",
        search_path: ".",
        matches: ["a.ts"],
        include_pattern: null,
        truncated: false,
        is_error: false,
      },
    };
    const events = [
      fileObs,
      grepObs,
      makeBashObservation("o-bash", "a-bash", "ls"),
    ];

    renderWithProviders(
      <EventGroup events={events} isFinalized>
        <div>child</div>
      </EventGroup>,
    );

    const summary = screen.getByTestId("event-group-summary");
    expect(summary).toHaveTextContent("EVENT_GROUP$SUMMARY_FILES");
    expect(summary).toHaveTextContent("EVENT_GROUP$SUMMARY_SEARCHES");
    expect(summary).toHaveTextContent("EVENT_GROUP$SUMMARY_COMMANDS");
    expect(screen.getByTestId("event-group-diff-stats")).toHaveTextContent(
      "+1",
    );
    expect(screen.getByTestId("event-group-diff-stats")).toHaveTextContent(
      "-1",
    );
  });

  it("shows a spinner while running and no status icon when done", () => {
    const running = [
      makeBashObservation("o1", "a1", "ls"),
      makeBashAction("a2", "pwd"),
    ];

    const { rerender } = renderWithProviders(
      <EventGroup events={running}>
        <div>child</div>
      </EventGroup>,
    );
    expect(screen.getByTestId("spinner-icon")).toBeInTheDocument();
    expect(screen.queryByTestId("status-icon")).not.toBeInTheDocument();

    const done = [
      makeBashObservation("o1", "a1", "ls"),
      makeBashObservation("o2", "a2", "pwd"),
    ];
    rerender(
      <EventGroup events={done}>
        <div>child</div>
      </EventGroup>,
    );
    expect(screen.queryByTestId("spinner-icon")).not.toBeInTheDocument();
    expect(screen.queryByTestId("status-icon")).not.toBeInTheDocument();
  });

  it("updates accessibility state while toggling the group", async () => {
    const events = [
      makeBashObservation("o1", "a1", "ls"),
      makeBashObservation("o2", "a2", "pwd"),
      makeBashObservation("o3", "a3", "whoami"),
    ];
    const user = userEvent.setup();

    renderWithProviders(
      <EventGroup events={events}>
        <div data-testid="child">child content</div>
      </EventGroup>,
    );

    const toggle = screen.getByTestId("event-group-toggle");
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveAttribute("aria-label", "EVENT_GROUP$EXPAND");
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
    expect(screen.queryByTestId("child")).not.toBeInTheDocument();

    await user.click(toggle);

    const content = screen.getByRole("region");
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(toggle).toHaveAttribute("aria-label", "EVENT_GROUP$COLLAPSE");
    expect(toggle).toHaveAttribute("aria-controls", content.id);
    expect(content).toHaveAttribute("aria-labelledby", toggle.id);
    expect(screen.getByTestId("child")).toBeInTheDocument();

    await user.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveAttribute("aria-label", "EVENT_GROUP$EXPAND");
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
    expect(screen.queryByTestId("child")).not.toBeInTheDocument();
  });

  it("keeps grouped file-action titles non-interactive inside the toggle", () => {
    const fileAction: ActionEvent<FileEditorAction> = {
      id: "a-file",
      timestamp: new Date().toISOString(),
      source: "agent",
      thought: [],
      thinking_blocks: [],
      action: {
        kind: "FileEditorAction",
        command: "str_replace",
        path: "src/app.ts",
        file_text: null,
        old_str: "a",
        new_str: "b",
        insert_line: null,
        view_range: null,
      },
      tool_name: "file_editor",
      tool_call_id: "call_a-file",
      tool_call: {
        id: "call_a-file",
        type: "function",
        function: {
          name: "file_editor",
          arguments: JSON.stringify({
            command: "str_replace",
            path: "src/app.ts",
          }),
        },
      },
      llm_response_id: "response_a-file",
      security_risk: SecurityRisk.UNKNOWN,
    };

    renderWithProviders(
      <EventGroup events={[fileAction]}>
        <div>child</div>
      </EventGroup>,
    );

    const toggle = screen.getByTestId("event-group-toggle");
    expect(
      toggle.querySelector('[data-testid="path-component-link"]'),
    ).toBeNull();
    expect(toggle.querySelectorAll("button")).toHaveLength(0);
  });
});
