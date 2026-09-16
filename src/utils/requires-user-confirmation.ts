import type { OpenHandsEvent } from "#/types/agent-server/core";
import { isActionEvent } from "#/types/agent-server/type-guards";

const TERMINAL_ACTION_KINDS = new Set(["ExecuteBashAction", "TerminalAction"]);

const FILE_EDITOR_ACTION_KINDS = new Set([
  "FileEditorAction",
  "StrReplaceEditorAction",
  "PlanningFileEditorAction",
]);

const MUTATING_FILE_COMMANDS = new Set([
  "create",
  "str_replace",
  "insert",
  "undo_edit",
]);

/**
 * True when confirmation mode should show the user confirmation card:
 * terminal commands, or file_editor writes/edits (not read-only `view`).
 */
export function requiresUserConfirmation(event: OpenHandsEvent): boolean {
  if (!isActionEvent(event)) {
    return false;
  }
  const { action } = event;
  if (TERMINAL_ACTION_KINDS.has(action.kind)) {
    return true;
  }
  if (!FILE_EDITOR_ACTION_KINDS.has(action.kind)) {
    return false;
  }
  return (
    "command" in action &&
    MUTATING_FILE_COMMANDS.has(
      (action as { command?: string }).command as string,
    )
  );
}

/**
 * Pending actions that confirmation mode can silently accept (browser, MCP,
 * file reads, task tracker, etc.). Inverse of {@link requiresUserConfirmation}.
 */
export function isAutoApprovablePendingAction(event: OpenHandsEvent): boolean {
  return isActionEvent(event) && !requiresUserConfirmation(event);
}
