import React from "react";
import { OpenHandsEvent } from "#/types/agent-server/core";
import { EventMessage } from "./event-message";
import { usePlanPreviewEvents } from "./hooks/use-plan-preview-events";
import { projectTimeline } from "./project-timeline";
import { EventGroup } from "./event-message-components/event-group";
import { ThoughtEventMessage } from "./event-message-components/thought-event-message";
import { useModelStore } from "#/stores/model-store";
import { ModelMessages } from "#/components/features/chat/model-messages";
import { useOptionalConversationId } from "#/hooks/use-conversation-id";
import { ConversationConfirmationCard } from "#/components/shared/buttons/conversation-confirmation-card";
import { useAgentState } from "#/hooks/use-agent-state";
import { useEventMessageStore } from "#/stores/event-message-store";
import { AgentState } from "#/types/agent-state";
import { AgentInterimStatus } from "./agent-interim-status";
import { shouldShowAgentInterimStatus } from "./should-show-agent-interim-status";
import { isStreamingDeltaEvent } from "#/types/agent-server/type-guards";
import { useReasoningStreamActive } from "#/hooks/use-reasoning-stream-active";

interface MessagesProps {
  messages: OpenHandsEvent[]; // UI events (actions replaced by observations)
  allEvents: OpenHandsEvent[]; // Full event history (for action lookup)
}

const getLastEventId = (events: OpenHandsEvent[]) => events.at(-1)?.id;
const getLastEvent = (events: OpenHandsEvent[]) => events.at(-1);

export const Messages: React.FC<MessagesProps> = React.memo(
  ({ messages, allEvents }) => {
    const { conversationId } = useOptionalConversationId();
    // Get the set of event IDs that should render PlanPreview
    // This ensures only one preview per user message "phase"
    const planPreviewEventIds = usePlanPreviewEvents(allEvents);

    // Set of event ids that have a /model entry anchored to them — used to
    // avoid mounting <ModelMessages> for every event (the component would
    // otherwise early-return null).
    const modelEntries = useModelStore((s) =>
      conversationId ? s.entriesByConversation[conversationId] : undefined,
    );
    const modelAnchorIds = React.useMemo(() => {
      if (!modelEntries || modelEntries.length === 0) return null;
      const ids = new Set<string>();
      for (const entry of modelEntries) {
        if (entry.anchorEventId !== null) ids.add(entry.anchorEventId);
      }
      return ids.size > 0 ? ids : null;
    }, [modelEntries]);

    const maybeRenderModelMessages = (eventId: string | number | undefined) => {
      if (!modelAnchorIds || eventId === undefined) return null;
      const key = String(eventId);
      if (!modelAnchorIds.has(key)) return null;
      return (
        <ModelMessages conversationId={conversationId} anchorEventId={key} />
      );
    };

    // Project the event history into ordered timeline rows: consecutive
    // action/observation events fold into collapsible groups, agent thoughts
    // are hoisted as their own rows, and a pending confirmation renders as a
    // card anchored right after the row holding the action awaiting approval
    // (see project-timeline.ts for the full contract).
    const { curAgentState } = useAgentState();
    const submittedEventIds = useEventMessageStore(
      (state) => state.submittedEventIds,
    );
    const awaitingConfirmation =
      curAgentState === AgentState.AWAITING_USER_CONFIRMATION;

    const renderedItems = React.useMemo(
      () =>
        projectTimeline({
          events: messages,
          allEvents,
          awaitingConfirmation,
          submittedEventIds,
        }),
      [messages, allEvents, awaitingConfirmation, submittedEventIds],
    );

    const lastMessage = messages.at(-1);
    const isTrailingDelta =
      lastMessage !== undefined && isStreamingDeltaEvent(lastMessage);
    const streamFingerprint = isTrailingDelta
      ? `${lastMessage.reasoning_content ?? ""}\u0000${lastMessage.content ?? ""}`
      : "";
    const isTextStreamActive = useReasoningStreamActive(
      streamFingerprint,
      isTrailingDelta &&
        (curAgentState === AgentState.RUNNING ||
          curAgentState === AgentState.LOADING),
    );

    const showInterimStatus = shouldShowAgentInterimStatus(
      curAgentState,
      lastMessage,
      { isTextStreamActive },
    );

    const renderEventMessage = (
      event: OpenHandsEvent,
      index: number,
      suppressThought: boolean,
    ) => (
      <EventMessage
        key={event.id}
        event={event}
        messages={allEvents}
        isLastMessage={messages.length - 1 === index}
        isInLast10Actions={messages.length - 1 - index < 10}
        planPreviewEventIds={planPreviewEventIds}
        suppressThought={suppressThought}
      />
    );

    return (
      <>
        {renderedItems.map((item, itemIndex) => {
          if (item.kind === "confirmation") {
            return (
              <ConversationConfirmationCard
                key={`confirmation-${item.event.id}`}
                event={item.event}
              />
            );
          }

          if (item.kind === "single") {
            return (
              <React.Fragment key={`single-${item.event.id}`}>
                {/* Thoughts for singles are also hoisted as their own
                    "thought" item, so suppress the inline render to avoid
                    duplication. */}
                {renderEventMessage(item.event, item.index, true)}
                {maybeRenderModelMessages(item.event.id)}
              </React.Fragment>
            );
          }

          if (item.kind === "thought") {
            return (
              <React.Fragment key={`thought-${item.action.id}`}>
                <ThoughtEventMessage event={item.action} />
                {maybeRenderModelMessages(item.action.id)}
              </React.Fragment>
            );
          }

          // A group is "finalized" once another rendered item appears after
          // it, signalling the agent has moved on. While the group is still
          // the live tail, it keeps showing the latest action title as its
          // prominent summary. A confirmation card anchored right after the
          // group doesn't finalize it — the pending action is still live.
          const isFinalized = renderedItems
            .slice(itemIndex + 1)
            .some((later) => later.kind !== "confirmation");
          const awaitingConfirmationHere =
            renderedItems[itemIndex + 1]?.kind === "confirmation";
          const groupKey = item.events[0]?.id ?? `group-${item.startIndex}`;
          return (
            <React.Fragment key={`group-${groupKey}`}>
              <EventGroup
                events={item.events}
                allEvents={allEvents}
                isFinalized={isFinalized}
                defaultExpanded={awaitingConfirmationHere}
              >
                {item.events.map((event, offset) =>
                  renderEventMessage(event, item.startIndex + offset, true),
                )}
              </EventGroup>
              {item.events.map((event) => (
                <React.Fragment key={`model-${event.id}`}>
                  {maybeRenderModelMessages(event.id)}
                </React.Fragment>
              ))}
            </React.Fragment>
          );
        })}
        {showInterimStatus ? <AgentInterimStatus /> : null}
      </>
    );
  },
  (prevProps, nextProps) =>
    prevProps.messages.length === nextProps.messages.length &&
    prevProps.allEvents.length === nextProps.allEvents.length &&
    getLastEventId(prevProps.messages) === getLastEventId(nextProps.messages) &&
    getLastEventId(prevProps.allEvents) ===
      getLastEventId(nextProps.allEvents) &&
    getLastEvent(prevProps.messages) === getLastEvent(nextProps.messages) &&
    getLastEvent(prevProps.allEvents) === getLastEvent(nextProps.allEvents),
);

Messages.displayName = "Messages";
