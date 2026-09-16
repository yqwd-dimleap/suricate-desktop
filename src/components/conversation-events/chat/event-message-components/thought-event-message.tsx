import React from "react";
import { ActionEvent } from "#/types/agent-server/core";
import { getActionThoughtText } from "../event-thought-helpers";
import { CollapsibleThinking } from "./collapsible-thinking";

interface ThoughtEventMessageProps {
  event: ActionEvent;
}

/**
 * Renders an `ActionEvent`'s agent thought as a Cursor-style collapsible
 * "Thought briefly" / "Thought Ns" header (same chrome as extended reasoning).
 */
export function ThoughtEventMessage({ event }: ThoughtEventMessageProps) {
  const thoughtContent = getActionThoughtText(event);

  if (!thoughtContent) {
    return null;
  }

  return <CollapsibleThinking content={thoughtContent} />;
}
