import { OpenHandsEvent } from "#/types/agent-server/core";
import {
  isActionEvent,
  isObservationEvent,
} from "#/types/agent-server/type-guards";
import { computeDiffStats } from "#/components/features/chat/tool-visualizers/primitives/diff-view";

const FILE_ACTION_KINDS = new Set([
  "FileEditorAction",
  "StrReplaceEditorAction",
]);
const FILE_OBS_KINDS = new Set([
  "FileEditorObservation",
  "StrReplaceEditorObservation",
]);
const SEARCH_ACTION_KINDS = new Set(["GrepAction", "GlobAction"]);
const SEARCH_OBS_KINDS = new Set(["GrepObservation", "GlobObservation"]);
const COMMAND_ACTION_KINDS = new Set(["ExecuteBashAction", "TerminalAction"]);
const COMMAND_OBS_KINDS = new Set([
  "ExecuteBashObservation",
  "TerminalObservation",
]);

const MUTATING_FILE_COMMANDS = new Set([
  "create",
  "str_replace",
  "insert",
  "undo_edit",
]);

export type EventGroupActivitySummary = {
  files: number;
  searches: number;
  commands: number;
  additions: number;
  deletions: number;
};

function isMutatingFileCommand(command: unknown): boolean {
  return typeof command === "string" && MUTATING_FILE_COMMANDS.has(command);
}

/**
 * Counts Cursor-style activity buckets for an event group: mutating file
 * edits, searches, and shell commands, plus aggregate +/- from file diffs.
 */
export function summarizeEventGroupActivity(
  events: OpenHandsEvent[],
): EventGroupActivitySummary {
  const filePaths = new Set<string>();
  let anonymousFiles = 0;
  let searches = 0;
  let commands = 0;
  let additions = 0;
  let deletions = 0;

  for (const event of events) {
    if (isActionEvent(event)) {
      const { kind } = event.action;
      if (FILE_ACTION_KINDS.has(kind)) {
        const action = event.action as {
          command?: string;
          path?: string | null;
        };
        if (isMutatingFileCommand(action.command)) {
          if (action.path) {
            filePaths.add(action.path);
          } else {
            anonymousFiles += 1;
          }
        }
      } else if (SEARCH_ACTION_KINDS.has(kind)) {
        searches += 1;
      } else if (COMMAND_ACTION_KINDS.has(kind)) {
        commands += 1;
      }
      continue;
    }

    if (!isObservationEvent(event)) {
      continue;
    }

    const { observation } = event;
    const { kind } = observation;

    if (FILE_OBS_KINDS.has(kind)) {
      const obs = observation as {
        command?: string;
        path?: string | null;
        old_content?: string | null;
        new_content?: string | null;
      };
      const hasDiff = obs.old_content != null && obs.new_content != null;
      const isCreate =
        obs.command === "create" && typeof obs.new_content === "string";
      if (hasDiff || isCreate || isMutatingFileCommand(obs.command)) {
        if (obs.path) {
          filePaths.add(obs.path);
        } else {
          anonymousFiles += 1;
        }
        if (hasDiff) {
          const stats = computeDiffStats(obs.old_content!, obs.new_content!);
          additions += stats.additions;
          deletions += stats.deletions;
        } else if (isCreate) {
          const stats = computeDiffStats("", obs.new_content!);
          additions += stats.additions;
          deletions += stats.deletions;
        }
      }
    } else if (SEARCH_OBS_KINDS.has(kind)) {
      searches += 1;
    } else if (COMMAND_OBS_KINDS.has(kind)) {
      commands += 1;
    }
  }

  return {
    files: filePaths.size + anonymousFiles,
    searches,
    commands,
    additions,
    deletions,
  };
}

export function hasEventGroupActivityParts(
  summary: EventGroupActivitySummary,
): boolean {
  return summary.files > 0 || summary.searches > 0 || summary.commands > 0;
}
