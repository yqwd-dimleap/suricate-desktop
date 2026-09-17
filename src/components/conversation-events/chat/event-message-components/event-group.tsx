import React from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronRight, LoaderCircle } from "lucide-react";
import { OpenHandsEvent, ActionEvent } from "#/types/agent-server/core";
import {
  isActionEvent,
  isObservationEvent,
} from "#/types/agent-server/type-guards";
import { I18nKey } from "#/i18n/declaration";
import { getEventContent } from "../event-content-helpers/get-event-content";
import {
  hasEventGroupActivityParts,
  summarizeEventGroupActivity,
} from "../event-content-helpers/summarize-event-group-activity";
import { IsInEventGroupContext } from "../../../features/chat/is-in-event-group-context";
import { PathInteractiveContext } from "../../../features/chat/path-component";

interface EventGroupProps {
  /** The events represented by this group. Used to compute the summary. */
  events: OpenHandsEvent[];
  /**
   * Full event history. Used to resolve the action that produced the latest
   * observation in the group so the summary title matches what the individual
   * card would show (e.g. "Editing path/to/file"). Falls back to `events` when
   * omitted.
   */
  allEvents?: OpenHandsEvent[];
  /**
   * `true` once an event outside this group has been emitted after it, so the
   * group is no longer the "live" tail of the chat. While `false` (the
   * default), the group keeps showing the most recent action's title as its
   * prominent summary while still running.
   */
  isFinalized?: boolean;
  /**
   * Open the grouped tool cards on first render. Used when this group holds
   * the action awaiting confirmation so the user does not have to expand it.
   */
  defaultExpanded?: boolean;
  /** The fully-rendered event messages to show when the group is expanded. */
  children: React.ReactNode;
}

/**
 * Collapsible container that wraps a run of consecutive agent action/observation
 * events into a single summary card.
 *
 * Collapsed while running (`isFinalized=false` and a pending action):
 *   - Left: latest action title + chevron
 *   - Right: progress count + spinner
 *
 * Collapsed when idle (no pending action):
 *   - Cursor-style activity summary when the group has files/searches/commands
 *     ("Editing N files, explored M searches, ran K commands +X -Y")
 *   - Otherwise the legacy "{count} actions completed" string
 *   - Chevron immediately after the summary (left-aligned with the label)
 *
 * Expanded: renders children verbatim.
 */
export function EventGroup({
  events,
  allEvents,
  isFinalized = false,
  defaultExpanded = false,
  children,
}: EventGroupProps) {
  const { t } = useTranslation("openhands");
  const [expanded, setExpanded] = React.useState(defaultExpanded);

  React.useEffect(() => {
    if (defaultExpanded) {
      setExpanded(true);
    }
  }, [defaultExpanded]);
  const contentId = React.useId();
  const buttonId = `${contentId}-toggle`;

  if (events.length === 0) {
    return null;
  }

  const pendingAction = events.find((e): e is ActionEvent => isActionEvent(e));
  const completedCount = events.filter(isObservationEvent).length;
  const totalCount = events.length;
  const isRunning = !!pendingAction;

  const latestEvent = events[events.length - 1];
  let latestTitle: React.ReactNode = null;
  if (latestEvent) {
    if (isActionEvent(latestEvent)) {
      latestTitle = getEventContent(latestEvent).title;
    } else if (isObservationEvent(latestEvent)) {
      const lookupSource = allEvents ?? events;
      const correspondingAction = lookupSource.find(
        (e): e is ActionEvent =>
          isActionEvent(e) && e.id === latestEvent.action_id,
      );
      latestTitle = getEventContent(latestEvent, correspondingAction).title;
    }
  }

  const activity = summarizeEventGroupActivity(events);
  const useActivitySummary = !isRunning && hasEventGroupActivityParts(activity);

  const activityParts: string[] = [];
  if (useActivitySummary) {
    if (activity.files > 0) {
      activityParts.push(
        t(I18nKey.EVENT_GROUP$SUMMARY_FILES, { count: activity.files }),
      );
    }
    if (activity.searches > 0) {
      activityParts.push(
        t(I18nKey.EVENT_GROUP$SUMMARY_SEARCHES, { count: activity.searches }),
      );
    }
    if (activity.commands > 0) {
      activityParts.push(
        t(I18nKey.EVENT_GROUP$SUMMARY_COMMANDS, { count: activity.commands }),
      );
    }
  }

  const countSummary = isRunning
    ? t(I18nKey.EVENT_GROUP$ACTIONS_PROGRESS, {
        completed: completedCount,
        total: totalCount,
      })
    : useActivitySummary
      ? activityParts.join(", ")
      : t(I18nKey.EVENT_GROUP$ACTIONS_COMPLETED, { count: totalCount });

  const Chevron = expanded ? ChevronDown : ChevronRight;
  const showLiveTitle = isRunning && !isFinalized;

  return (
    <div className="my-1 w-full py-1 text-sm" data-testid="event-group">
      <button
        id={buttonId}
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        aria-controls={contentId}
        aria-expanded={expanded}
        aria-label={
          expanded
            ? t(I18nKey.EVENT_GROUP$COLLAPSE)
            : t(I18nKey.EVENT_GROUP$EXPAND)
        }
        data-testid="event-group-toggle"
        className="w-full flex items-center justify-between gap-2 text-left cursor-pointer"
      >
        {showLiveTitle ? (
          <>
            <span className="flex min-w-0 items-center gap-2 font-normal text-[var(--oh-muted)]">
              <span className="truncate">
                <PathInteractiveContext.Provider value={false}>
                  {latestTitle ?? countSummary}
                </PathInteractiveContext.Provider>
              </span>
              <Chevron className="h-4 w-4 flex-shrink-0" aria-hidden />
            </span>
            <span className="flex flex-shrink-0 items-center gap-2 font-normal text-[var(--oh-muted)]">
              <span className="truncate">{countSummary}</span>
              <LoaderCircle
                data-testid="spinner-icon"
                className="h-4 w-4 inline animate-spin text-[var(--oh-muted)]"
              />
            </span>
          </>
        ) : (
          <span className="flex min-w-0 items-center gap-2 font-normal text-[var(--oh-muted)]">
            <span
              className="truncate min-w-0"
              data-testid="event-group-summary"
            >
              {countSummary}
            </span>
            {useActivitySummary &&
              (activity.additions > 0 || activity.deletions > 0) && (
                <span
                  className="shrink-0 font-mono text-xs tabular-nums"
                  data-testid="event-group-diff-stats"
                >
                  {activity.additions > 0 && (
                    <span className="text-[var(--oh-status-success)]">
                      {`+${activity.additions}`}
                    </span>
                  )}
                  {activity.additions > 0 && activity.deletions > 0
                    ? " "
                    : null}
                  {activity.deletions > 0 && (
                    <span className="text-[var(--oh-status-error)]">
                      {`-${activity.deletions}`}
                    </span>
                  )}
                </span>
              )}
            <Chevron className="h-4 w-4 flex-shrink-0" aria-hidden />
          </span>
        )}
      </button>

      {expanded && (
        <div
          id={contentId}
          role="region"
          aria-labelledby={buttonId}
          className="mt-1.5 flex flex-col"
          data-testid="event-group-content"
        >
          <IsInEventGroupContext.Provider value>
            {children}
          </IsInEventGroupContext.Provider>
        </div>
      )}
    </div>
  );
}
