import { useEffect, useRef } from "react";

import { useActiveConversation } from "#/hooks/query/use-active-conversation";
import { useRespondToConfirmation } from "#/hooks/mutation/use-respond-to-confirmation";
import { useAgentState } from "#/hooks/use-agent-state";
import { useEventStore } from "#/stores/use-event-store";
import { useEventMessageStore } from "#/stores/event-message-store";
import { AgentState } from "#/types/agent-state";
import { findAwaitingConfirmationEvent } from "#/components/conversation-events/chat/project-timeline";
import { isAutoApprovablePendingAction } from "#/utils/requires-user-confirmation";

/**
 * When confirmation mode pauses on a "safe" action (not terminal / not a
 * mutating file edit), accept immediately so the card never appears.
 */
export function useAutoApproveSafeActions(): void {
  const events = useEventStore((state) => state.events);
  const { curAgentState } = useAgentState();
  const { data: conversation } = useActiveConversation();
  const { mutate: respondToConfirmation, isPending } =
    useRespondToConfirmation();
  const submittedEventIds = useEventMessageStore(
    (state) => state.submittedEventIds,
  );
  const addSubmittedEventId = useEventMessageStore(
    (state) => state.addSubmittedEventId,
  );
  const removeSubmittedEventId = useEventMessageStore(
    (state) => state.removeSubmittedEventId,
  );
  const inFlightIdRef = useRef<string | number | null>(null);

  useEffect(() => {
    if (curAgentState !== AgentState.AWAITING_USER_CONFIRMATION) {
      return;
    }
    if (!conversation || isPending) {
      return;
    }

    const awaiting = findAwaitingConfirmationEvent(events);
    if (awaiting?.id === undefined) {
      return;
    }
    if (!isAutoApprovablePendingAction(awaiting)) {
      return;
    }
    if (
      submittedEventIds.includes(awaiting.id) ||
      inFlightIdRef.current === awaiting.id
    ) {
      return;
    }

    const awaitingId = awaiting.id;
    inFlightIdRef.current = awaitingId;
    addSubmittedEventId(awaitingId);

    respondToConfirmation(
      {
        conversationId: conversation.id,
        conversationUrl: conversation.conversation_url || "",
        sessionApiKey: conversation.session_api_key,
        accept: true,
      },
      {
        onError: () => {
          inFlightIdRef.current = null;
          removeSubmittedEventId(awaitingId);
        },
        onSettled: () => {
          if (inFlightIdRef.current === awaitingId) {
            inFlightIdRef.current = null;
          }
        },
      },
    );
  }, [
    addSubmittedEventId,
    conversation,
    curAgentState,
    events,
    isPending,
    removeSubmittedEventId,
    respondToConfirmation,
    submittedEventIds,
  ]);
}

/** @deprecated Use {@link useAutoApproveSafeActions}. */
export const useAutoApproveFileReads = useAutoApproveSafeActions;
