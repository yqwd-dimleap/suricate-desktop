import { useEffect, useRef } from "react";

import { useOptionalConversationId } from "#/hooks/use-conversation-id";
import { useActiveConversation } from "#/hooks/query/use-active-conversation";
import { useEventStore, type OHEvent } from "#/stores/use-event-store";
import { useAgentReviewStore } from "#/stores/agent-review-store";
import { useFilesTabStore } from "#/stores/files-tab-store";
import { isUserMessageEvent } from "#/types/agent-server/type-guards";
import { toFilesTabPath } from "#/utils/path-utils";
import { computeDiffRevealRange } from "#/components/features/chat/tool-visualizers/primitives/diff-view";

const FILE_EDIT_OBSERVATION_KINDS = new Set([
  "FileEditorObservation",
  "StrReplaceEditorObservation",
  "PlanningFileEditorObservation",
]);

const READ_ONLY_COMMANDS = new Set(["view"]);

function isMutatingFileEditorObservation(event: OHEvent): boolean {
  const obs = (
    event as {
      observation?: {
        kind?: string;
        command?: string;
      };
    }
  ).observation;
  if (!obs || typeof obs.kind !== "string") return false;
  if (!FILE_EDIT_OBSERVATION_KINDS.has(obs.kind)) return false;
  if (obs.command && READ_ONLY_COMMANDS.has(obs.command)) return false;
  return true;
}

function ingestMutatingObservation(
  conversationId: string,
  workingDir: string | undefined,
  event: OHEvent,
) {
  const obs = (
    event as {
      observation: {
        path?: string | null;
        old_content?: string | null;
        new_content?: string | null;
        prev_exist?: boolean;
      };
    }
  ).observation;
  if (obs.path == null || obs.new_content == null) {
    return;
  }
  const path = toFilesTabPath(obs.path, workingDir) || obs.path;
  const baseline = obs.old_content ?? "";
  const current = obs.new_content;
  if (
    !useAgentReviewStore.getState().byConversation[conversationId]
      ?.activeCheckpointId
  ) {
    useAgentReviewStore.getState().openCheckpoint(conversationId, "anonymous");
  }
  const checkpointId =
    useAgentReviewStore.getState().byConversation[conversationId]
      ?.activeCheckpointId ?? "anonymous";
  useAgentReviewStore.getState().ingestObservation({
    conversationId,
    checkpointId,
    path,
    baseline,
    current,
    prevExist: obs.prev_exist !== false,
  });
  const reveal = computeDiffRevealRange(baseline, current);
  if (reveal) {
    useFilesTabStore.getState().setStickyReveal(path, reveal);
  }
}

/**
 * Mirrors mutating file-editor observations into the Cursor-style review
 * store and opens a checkpoint on each user message.
 */
export function useSyncAgentReviewFromEvents(): void {
  const { conversationId } = useOptionalConversationId();
  const { data: conversation } = useActiveConversation();
  const events = useEventStore((state) => state.events);
  const workingDir = conversation?.workspace?.working_dir;
  const processedIdsRef = useRef<Set<string | number>>(new Set());
  const processedEventsRef = useRef<WeakSet<OHEvent>>(new WeakSet());

  useEffect(() => {
    if (!conversationId) {
      return;
    }
    for (const event of events) {
      const id: string | number | undefined =
        "id" in event ? event.id : undefined;
      const alreadyProcessed =
        id !== undefined
          ? processedIdsRef.current.has(id)
          : processedEventsRef.current.has(event);
      if (!alreadyProcessed) {
        if (id !== undefined) {
          processedIdsRef.current.add(id);
        } else {
          processedEventsRef.current.add(event);
        }
        if (isUserMessageEvent(event) && event.id !== undefined) {
          useAgentReviewStore
            .getState()
            .openCheckpoint(conversationId, String(event.id));
        }
        if (isMutatingFileEditorObservation(event)) {
          ingestMutatingObservation(
            conversationId,
            workingDir ?? undefined,
            event,
          );
        }
      }
    }
  }, [conversationId, events, workingDir]);
}
