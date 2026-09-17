import {
  OpenHandsEvent,
  ActionEvent,
  ObservationEvent,
} from "#/types/agent-server/core";
import { InvokeSkillObservation } from "#/types/agent-server/core/base/observation";
import { I18nKey } from "#/i18n/declaration";
import { GenericEventMessage } from "../../../features/chat/generic-event-message";
import { getEventContent } from "../event-content-helpers/get-event-content";
import {
  getActionEventTitleDescriptor,
  resolveEventTitlePlainText,
} from "../event-content-helpers/get-action-event-title";
import {
  getACPToolCallResult,
  getObservationResult,
  ObservationResultStatus,
} from "../event-content-helpers/get-observation-result";
import {
  isACPToolCallEvent,
  isActionEvent,
  isObservationEvent,
} from "#/types/agent-server/type-guards";
import {
  SkillReadyEvent,
  SkillReadyItem,
  isSkillReadyEvent,
} from "../event-content-helpers/create-skill-ready-event";
import { getInvokeSkillItems } from "../event-content-helpers/get-invoke-skill-items";
import { SkillReadyContentList } from "./skill-ready-content-list";
import SkillsIcon from "#/icons/skills.svg?react";
import {
  isMarkdownFilePath,
  isMarkdownFileEditorEvent,
} from "#/components/features/chat/tool-visualizers/primitives/markdown-file-preview";
import { TextShimmer } from "#/components/shared/text-shimmer";
import { useTranslation } from "react-i18next";
import React from "react";

interface GenericEventMessageWrapperProps {
  event: OpenHandsEvent | SkillReadyEvent;
  isLastMessage: boolean;
  correspondingAction?: ActionEvent;
}

/**
 * Resolves the expandable skill-knowledge list shared by Skill Ready events and
 * invoke-skill tool observations. Returns the list items and their header
 * label, or null when the event carries no skill knowledge (so the caller keeps
 * the default details body). Additional skill-knowledge sources slot in as one
 * more branch here.
 */
function getSkillKnowledge(
  event: OpenHandsEvent | SkillReadyEvent,
): { items: SkillReadyItem[]; titleKey: I18nKey } | null {
  if (isSkillReadyEvent(event)) {
    return event._skillReadyItems.length > 0
      ? {
          items: event._skillReadyItems,
          titleKey: I18nKey.SKILLS$TRIGGERED_SKILL_KNOWLEDGE,
        }
      : null;
  }
  if (
    isObservationEvent(event) &&
    event.observation.kind === "InvokeSkillObservation"
  ) {
    const items = getInvokeSkillItems(
      event as ObservationEvent<InvokeSkillObservation>,
    );
    return items.length > 0
      ? { items, titleKey: I18nKey.SKILLS$INVOKED_SKILL_KNOWLEDGE }
      : null;
  }
  return null;
}

/**
 * Mutating file-editor observations that render the Cursor-style review card
 * own their filename header — skip the outer "Edited …" GenericEventMessage
 * chrome so the card isn't duplicated.
 */
function isSelfTitledFileEditorReview(
  event: OpenHandsEvent | SkillReadyEvent,
): boolean {
  if (isSkillReadyEvent(event) || !isObservationEvent(event)) {
    return false;
  }
  const { observation } = event;
  if (
    observation.kind !== "FileEditorObservation" &&
    observation.kind !== "StrReplaceEditorObservation"
  ) {
    return false;
  }
  if (observation.error) {
    return false;
  }
  if (observation.old_content != null && observation.new_content != null) {
    return true;
  }
  return (
    observation.command === "create" &&
    observation.new_content != null &&
    typeof observation.path === "string" &&
    !isMarkdownFilePath(observation.path)
  );
}

export function GenericEventMessageWrapper({
  event,
  correspondingAction,
}: GenericEventMessageWrapperProps) {
  const { t } = useTranslation("openhands");
  const { title, details } = getEventContent(event, correspondingAction);

  // TaskTrackerObservation has its own rendering
  if (
    !isSkillReadyEvent(event) &&
    isObservationEvent(event) &&
    event.observation.kind === "TaskTrackerObservation"
  ) {
    return <div>{details}</div>;
  }

  // Cursor-style file review cards include their own header.
  if (isSelfTitledFileEditorReview(event)) {
    return <div>{details}</div>;
  }

  // Determine success status
  let success: ObservationResultStatus | undefined;
  if (isSkillReadyEvent(event)) {
    success = "success";
  } else if (isObservationEvent(event)) {
    success = getObservationResult(event);
  } else if (isACPToolCallEvent(event)) {
    success = getACPToolCallResult(event);
  }

  // Skill Ready events and invoke-skill tool observations both render the
  // expandable skill-knowledge list (with the skills icon); they differ only in
  // the header label.
  const skillKnowledge = getSkillKnowledge(event);
  const bodyDetails = skillKnowledge ? (
    <SkillReadyContentList
      items={skillKnowledge.items}
      titleKey={skillKnowledge.titleKey}
    />
  ) : (
    details
  );

  // Markdown file-editor cards carry a clipped preview; expand them by
  // default so the artifact is visible without an extra chevron click.
  const initiallyExpanded =
    !isSkillReadyEvent(event) &&
    isMarkdownFileEditorEvent(event, correspondingAction);

  // In-flight tool rows use the Cursor-style sweep so "what's happening now"
  // is visually distinct from settled observation titles.
  let displayTitle: React.ReactNode = title;
  if (!isSkillReadyEvent(event) && isActionEvent(event)) {
    const plain = resolveEventTitlePlainText(
      getActionEventTitleDescriptor(event),
      (key, values) => t(key, values),
    );
    displayTitle = (
      <TextShimmer
        as="span"
        className="text-sm"
        duration={2.2}
        spread={2}
        data-testid="in-progress-event-title"
      >
        {plain}
      </TextShimmer>
    );
  }

  return (
    <div>
      <GenericEventMessage
        title={displayTitle}
        details={bodyDetails}
        success={success}
        initiallyExpanded={initiallyExpanded}
        timestamp={event.timestamp}
        titleIcon={
          skillKnowledge ? (
            <SkillsIcon className="h-4 w-4 stroke-[var(--oh-muted)] flex-shrink-0 mr-2" />
          ) : undefined
        }
      />
    </div>
  );
}
