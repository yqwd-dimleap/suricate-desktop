import { describe, it, expect } from "vitest";
import {
  hasEventGroupActivityParts,
  summarizeEventGroupActivity,
} from "#/components/conversation-events/chat/event-content-helpers/summarize-event-group-activity";
import {
  ActionEvent,
  ObservationEvent,
  SecurityRisk,
} from "#/types/agent-server/core";
import {
  ExecuteBashAction,
  FileEditorAction,
  GrepAction,
} from "#/types/agent-server/core/base/action";
import {
  ExecuteBashObservation,
  FileEditorObservation,
  GrepObservation,
} from "#/types/agent-server/core/base/observation";

const makeBashObservation = (
  id: string,
  actionId: string,
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
    command: "ls",
    exit_code: 0,
    error: false,
    timeout: false,
    metadata: {} as never,
  },
});

const makeFileObservation = (
  id: string,
  actionId: string,
  path: string,
  oldContent: string,
  newContent: string,
): ObservationEvent<FileEditorObservation> => ({
  id,
  timestamp: new Date().toISOString(),
  source: "environment",
  tool_name: "file_editor",
  tool_call_id: `call_${actionId}`,
  action_id: actionId,
  observation: {
    kind: "FileEditorObservation",
    content: [],
    command: "str_replace",
    path,
    old_content: oldContent,
    new_content: newContent,
    prev_exist: true,
    output: "",
    error: null,
  } as FileEditorObservation,
});

const makeGrepObservation = (
  id: string,
  actionId: string,
): ObservationEvent<GrepObservation> => ({
  id,
  timestamp: new Date().toISOString(),
  source: "environment",
  tool_name: "grep",
  tool_call_id: `call_${actionId}`,
  action_id: actionId,
  observation: {
    kind: "GrepObservation",
    content: [],
    pattern: "foo",
    search_path: ".",
    matches: ["a.ts"],
    include_pattern: null,
    truncated: false,
    is_error: false,
  } as GrepObservation,
});

describe("summarizeEventGroupActivity", () => {
  it("counts files, searches, commands and aggregate diff stats", () => {
    const summary = summarizeEventGroupActivity([
      makeFileObservation("o1", "a1", "/workspace/a.ts", "old\n", "new\n"),
      makeFileObservation("o2", "a2", "/workspace/b.ts", "x\n", "x\ny\n"),
      makeGrepObservation("o3", "a3"),
      makeBashObservation("o4", "a4"),
    ]);

    expect(summary).toEqual({
      files: 2,
      searches: 1,
      commands: 1,
      additions: 2,
      deletions: 1,
    });
    expect(hasEventGroupActivityParts(summary)).toBe(true);
  });

  it("dedupes the same file path edited twice", () => {
    const summary = summarizeEventGroupActivity([
      makeFileObservation("o1", "a1", "/workspace/a.ts", "a", "b"),
      makeFileObservation("o2", "a2", "/workspace/a.ts", "b", "c"),
    ]);

    expect(summary.files).toBe(1);
    expect(summary.additions).toBe(2);
    expect(summary.deletions).toBe(2);
  });

  it("ignores view-only file observations", () => {
    const view: ObservationEvent<FileEditorObservation> = {
      ...makeFileObservation("o1", "a1", "/workspace/a.ts", "", ""),
      observation: {
        kind: "FileEditorObservation",
        content: [{ type: "text", text: "1\tcode" }],
        command: "view",
        path: "/workspace/a.ts",
        old_content: null,
        new_content: null,
        prev_exist: true,
        output: "",
        error: null,
      } as FileEditorObservation,
    };

    const summary = summarizeEventGroupActivity([
      view,
      makeBashObservation("o2", "a2"),
    ]);

    expect(summary.files).toBe(0);
    expect(summary.commands).toBe(1);
  });

  it("counts in-flight mutating file and search actions", () => {
    const fileAction: ActionEvent<FileEditorAction> = {
      id: "a1",
      timestamp: new Date().toISOString(),
      source: "agent",
      thought: [],
      thinking_blocks: [],
      action: {
        kind: "FileEditorAction",
        command: "str_replace",
        path: "/workspace/a.ts",
        file_text: null,
        old_str: "a",
        new_str: "b",
        insert_line: null,
        view_range: null,
      },
      tool_name: "file_editor",
      tool_call_id: "call_a1",
      tool_call: {
        id: "call_a1",
        type: "function",
        function: { name: "file_editor", arguments: "{}" },
      },
      llm_response_id: "r1",
      security_risk: SecurityRisk.UNKNOWN,
    };
    const grepAction: ActionEvent<GrepAction> = {
      id: "a2",
      timestamp: new Date().toISOString(),
      source: "agent",
      thought: [],
      thinking_blocks: [],
      action: {
        kind: "GrepAction",
        pattern: "foo",
        path: ".",
        include: null,
      } as GrepAction,
      tool_name: "grep",
      tool_call_id: "call_a2",
      tool_call: {
        id: "call_a2",
        type: "function",
        function: { name: "grep", arguments: "{}" },
      },
      llm_response_id: "r2",
      security_risk: SecurityRisk.UNKNOWN,
    };
    const bashAction: ActionEvent<ExecuteBashAction> = {
      id: "a3",
      timestamp: new Date().toISOString(),
      source: "agent",
      thought: [],
      thinking_blocks: [],
      action: {
        kind: "ExecuteBashAction",
        command: "ls",
        is_input: false,
        timeout: null,
        reset: false,
      },
      tool_name: "execute_bash",
      tool_call_id: "call_a3",
      tool_call: {
        id: "call_a3",
        type: "function",
        function: { name: "execute_bash", arguments: "{}" },
      },
      llm_response_id: "r3",
      security_risk: SecurityRisk.UNKNOWN,
    };

    expect(
      summarizeEventGroupActivity([fileAction, grepAction, bashAction]),
    ).toEqual({
      files: 1,
      searches: 1,
      commands: 1,
      additions: 0,
      deletions: 0,
    });
  });

  it("reports no activity parts for an empty mix", () => {
    expect(hasEventGroupActivityParts(summarizeEventGroupActivity([]))).toBe(
      false,
    );
  });
});
