import React from "react";
import { useTranslation } from "react-i18next";
import ArrowDown from "#/icons/angle-down-solid.svg?react";
import ArrowUp from "#/icons/angle-up-solid.svg?react";
import LightbulbIcon from "#/icons/lightbulb.svg?react";
import { I18nKey } from "#/i18n/declaration";
import { TextShimmer } from "../../../shared/text-shimmer";
import { MarkdownRenderer } from "../../../features/markdown/markdown-renderer";

interface CollapsibleThinkingProps {
  /** The thinking / reasoning content to display when expanded. */
  content: string;
  /**
   * True while the agent is still producing this reasoning. The label shows
   * an animated shimmer while in progress; once the thought lands the
   * animation stops and the label flips from "Thinking" to "Thought".
   */
  isThinking?: boolean;
}

/**
 * Renders agent thinking or extended reasoning content inside a collapsible
 * section.  Collapsed by default so the chat stays compact — especially
 * useful when the thinking language differs from the conversation language.
 */
export function CollapsibleThinking({
  content,
  isThinking = false,
}: CollapsibleThinkingProps) {
  const { t } = useTranslation("openhands");
  const [expanded, setExpanded] = React.useState(false);

  if (!content.trim()) {
    return null;
  }

  const Chevron = expanded ? ArrowUp : ArrowDown;

  return (
    <div
      className="mt-1 w-full pt-1 text-sm"
      data-testid="collapsible-thinking"
      data-thinking={isThinking || undefined}
    >
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
        aria-label={
          expanded ? t(I18nKey.THINKING$COLLAPSE) : t(I18nKey.THINKING$EXPAND)
        }
        data-testid="collapsible-thinking-toggle"
        className="w-full flex items-center gap-2 text-left cursor-pointer"
      >
        <Chevron className="h-4 w-4 fill-[var(--oh-muted)] flex-shrink-0" />
        {isThinking ? (
          <TextShimmer
            as="span"
            data-testid="collapsible-thinking-label"
            className="font-normal"
            duration={1.2}
            spread={4}
            base="var(--cool-grey-600)"
            highlight="color-mix(in srgb, var(--oh-color-primary) 55%, white)"
          >
            {t(I18nKey.THINKING$TITLE)}
          </TextShimmer>
        ) : (
          <>
            <LightbulbIcon className="h-4 w-4 fill-[var(--oh-muted)] flex-shrink-0" />
            <span className="font-normal text-[var(--oh-muted)]">
              {t(I18nKey.OBSERVATION_MESSAGE$THINK)}
            </span>
          </>
        )}
      </button>

      {expanded && (
        <div className="mt-1.5 pl-6" data-testid="collapsible-thinking-content">
          <MarkdownRenderer>{content}</MarkdownRenderer>
        </div>
      )}
    </div>
  );
}
