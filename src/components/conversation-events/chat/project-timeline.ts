import { OpenHandsEvent } from "#/types/agent-server/core";
import {
  isActionEvent,
  isObservationEvent,
} from "#/types/agent-server/type-guards";
import { groupEvents, RenderedItem } from "./group-events";

/**
 * A rendered row of the conversation timeline. Extends the grouped event
 * items with a `confirmation` row that is anchored right after the tool row
 * whose action the agent is waiting to have approved — instead of being a
 * floating block at the end of the message list.
 */
export type TimelineItem =
  | RenderedItem
  | { kind: "confirmation"; event: OpenHandsEvent };

export interface TimelineInput {
  /** UI events (actions replaced by observations once they complete). */
  events: OpenHandsEvent[];
  /** Full event history, used for action lookup and confirmation targeting. */
  allEvents: OpenHandsEvent[];
  /** True while the agent state is AWAITING_USER_CONFIRMATION. */
  awaitingConfirmation: boolean;
  /** Event ids whose confirmation response was already accepted by the server. */
  submittedEventIds: ReadonlyArray<string | number>;
}

/**
 * The event the pending confirmation refers to: the most recent agent action
 * that has no observation yet (the server holds it until the user responds).
 * Falls back to the last agent-sourced event so the card still has an anchor
 * when the pending action is missing from the loaded history page.
 */
export const findAwaitingConfirmationEvent = (
  allEvents: OpenHandsEvent[],
): OpenHandsEvent | null => {
  const observedActionIds = new Set(
    allEvents.filter(isObservationEvent).map((event) => event.action_id),
  );

  for (let i = allEvents.length - 1; i >= 0; i -= 1) {
    const event = allEvents[i];
    if (isActionEvent(event) && !observedActionIds.has(event.id)) {
      return event;
    }
  }

  for (let i = allEvents.length - 1; i >= 0; i -= 1) {
    if (allEvents[i].source === "agent") {
      return allEvents[i];
    }
  }

  return null;
};

const itemContainsEvent = (item: RenderedItem, eventId: string): boolean => {
  switch (item.kind) {
    case "single":
      return item.event.id === eventId;
    case "thought":
      return item.action.id === eventId;
    case "group":
      return item.events.some((event) => event.id === eventId);
    default:
      return false;
  }
};

const lastIndexContaining = (
  items: RenderedItem[],
  eventId: string,
): number => {
  for (let i = items.length - 1; i >= 0; i -= 1) {
    if (itemContainsEvent(items[i], eventId)) {
      return i;
    }
  }
  return -1;
};

/**
 * Projects the event history into an ordered list of timeline rows.
 *
 * Delegates grouping/thought-hoisting to `groupEvents` and, when the agent is
 * awaiting confirmation, inserts a single `confirmation` row immediately
 * after the row containing the pending action (appended at the end when the
 * action isn't part of the rendered events). Already-submitted confirmations
 * never produce a row, so an in-flight accept cannot render a second card.
 */
export const projectTimeline = ({
  events,
  allEvents,
  awaitingConfirmation,
  submittedEventIds,
}: TimelineInput): TimelineItem[] => {
  const base: RenderedItem[] = groupEvents(events, undefined, allEvents);
  if (!awaitingConfirmation) {
    return base;
  }

  const awaiting = findAwaitingConfirmationEvent(allEvents);
  if (!awaiting) {
    return base;
  }
  if (awaiting.id !== undefined && submittedEventIds.includes(awaiting.id)) {
    return base;
  }

  const confirmation: TimelineItem = { kind: "confirmation", event: awaiting };
  const anchorIndex =
    awaiting.id !== undefined ? lastIndexContaining(base, awaiting.id) : -1;
  if (anchorIndex === -1) {
    return [...base, confirmation];
  }

  return [
    ...base.slice(0, anchorIndex + 1),
    confirmation,
    ...base.slice(anchorIndex + 1),
  ];
};
