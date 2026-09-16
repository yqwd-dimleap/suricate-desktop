import { describe, expect, it } from "vitest";
import type { ActionEvent } from "#/types/agent-server/core";
import type {
  BrowserGetStateAction,
  ExecuteBashAction,
  FileEditorAction,
} from "#/types/agent-server/core/base/action";
import { SecurityRisk } from "#/types/agent-server/core/base/common";
import {
  isAutoApprovablePendingAction,
  requiresUserConfirmation,
} from "#/utils/requires-user-confirmation";

const timestamp = "2026-09-16T12:00:00.000Z";

const fileEditorAction = (
  id: string,
  command: FileEditorAction["command"],
): ActionEvent<FileEditorAction> => ({
  id,
  timestamp,
  source: "agent",
  thought: [],
  thinking_blocks: [],
  action: {
    kind: "FileEditorAction",
    command,
    path: "/workspace/app.ts",
    file_text: null,
    old_str: null,
    new_str: null,
    insert_line: null,
    view_range: null,
  },
  tool_name: "file_editor",
  tool_call_id: `tool-${id}`,
  tool_call: {
    id: `tool-${id}`,
    type: "function",
    function: { name: "file_editor", arguments: "{}" },
  },
  llm_response_id: `response-${id}`,
  security_risk: SecurityRisk.LOW,
});

const bashAction = (id: string): ActionEvent<ExecuteBashAction> => ({
  id,
  timestamp,
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
  tool_name: "terminal",
  tool_call_id: `tool-${id}`,
  tool_call: {
    id: `tool-${id}`,
    type: "function",
    function: { name: "terminal", arguments: "{}" },
  },
  llm_response_id: `response-${id}`,
  security_risk: SecurityRisk.LOW,
});

const browserAction = (id: string): ActionEvent<BrowserGetStateAction> => ({
  id,
  timestamp,
  source: "agent",
  thought: [],
  thinking_blocks: [],
  action: {
    kind: "BrowserGetStateAction",
    include_screenshot: false,
  },
  tool_name: "browser",
  tool_call_id: `tool-${id}`,
  tool_call: {
    id: `tool-${id}`,
    type: "function",
    function: { name: "browser", arguments: "{}" },
  },
  llm_response_id: `response-${id}`,
  security_risk: SecurityRisk.LOW,
});

describe("requiresUserConfirmation", () => {
  it("requires confirmation for terminal commands", () => {
    expect(requiresUserConfirmation(bashAction("t1"))).toBe(true);
  });

  it("requires confirmation for mutating file_editor commands", () => {
    expect(requiresUserConfirmation(fileEditorAction("e1", "str_replace"))).toBe(
      true,
    );
    expect(requiresUserConfirmation(fileEditorAction("c1", "create"))).toBe(
      true,
    );
    expect(requiresUserConfirmation(fileEditorAction("i1", "insert"))).toBe(
      true,
    );
  });

  it("does not require confirmation for file_editor view", () => {
    expect(requiresUserConfirmation(fileEditorAction("v1", "view"))).toBe(
      false,
    );
  });

  it("does not require confirmation for other tools", () => {
    expect(requiresUserConfirmation(browserAction("b1"))).toBe(false);
  });
});

describe("isAutoApprovablePendingAction", () => {
  it("auto-approves reads and non-write tools", () => {
    expect(isAutoApprovablePendingAction(fileEditorAction("v1", "view"))).toBe(
      true,
    );
    expect(isAutoApprovablePendingAction(browserAction("b1"))).toBe(true);
  });

  it("does not auto-approve terminal or file writes", () => {
    expect(isAutoApprovablePendingAction(bashAction("t1"))).toBe(false);
    expect(
      isAutoApprovablePendingAction(fileEditorAction("e1", "str_replace")),
    ).toBe(false);
  });
});
