import React from "react";
import { useTranslation } from "react-i18next";
import ArrowDown from "#/icons/angle-down-solid.svg?react";
import ArrowUp from "#/icons/angle-up-solid.svg?react";
import { I18nKey } from "#/i18n/declaration";
import { useThinkingElapsedSeconds } from "#/hooks/use-thinking-elapsed-seconds";
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
 * Cursor-style thinking header: compact chevron + shimmering "Thinking" +
 * muted elapsed seconds while live; settles to a static "Thought" + duration.
 * Collapsed by default so the chat stays compact.
 */
export function CollapsibleThinking({
  content,
  isThinking = false,
}: CollapsibleThinkingProps) {
  const { t } = useTranslation("openhands");
  const [expanded, setExpanded] = React.useState(false);
  const elapsedSeconds = useThinkingElapsedSeconds(isThinking, content);
  const hasContent = content.trim().length > 0;

  // Cursor shows the header as soon as thinking starts, even before the first
  // reasoning token arrives. Historical empty thoughts stay hidden.
  if (!hasContent && !isThinking) {
    return null;
  }

  const Chevron = expanded ? ArrowUp : ArrowDown;
  const elapsedLabel =
    elapsedSeconds == null
      ? null
      : t(I18nKey.THINKING$ELAPSED, { seconds: elapsedSeconds });

  return (
    <div
      className="mt-1 w-full pt-1 text-sm"
      data-testid="collapsible-thinking"
      data-thinking={isThinking || undefined}
    >
      <button
        type="button"
        onClick={() => {
          if (hasContent) {
            setExpanded((prev) => !prev);
          }
        }}
        aria-expanded={hasContent ? expanded : undefined}
        aria-label={
          expanded ? t(I18nKey.THINKING$COLLAPSE) : t(I18nKey.THINKING$EXPAND)
        }
        data-testid="collapsible-thinking-toggle"
        className="flex w-full cursor-pointer items-center gap-1 text-left"
        disabled={!hasContent}
      >
        <Chevron className="h-3.5 w-3.5 flex-shrink-0 fill-[var(--oh-muted)]" />
        {isThinking ? (
          <TextShimmer
            as="span"
            data-testid="collapsible-thinking-label"
            className="text-sm font-normal"
            duration={2}
            spread={3}
            base="var(--oh-muted)"
            highlight="var(--oh-foreground)"
          >
            {t(I18nKey.THINKING$TITLE)}
          </TextShimmer>
        ) : (
          <span className="text-sm font-normal text-[var(--oh-muted)]">
            {t(I18nKey.OBSERVATION_MESSAGE$THINK)}
          </span>
        )}
        {elapsedLabel != null && (
          <span
            className="text-sm font-normal text-[var(--oh-muted)]"
            data-testid="collapsible-thinking-elapsed"
            data-seconds={elapsedSeconds ?? undefined}
          >
            {elapsedLabel}
          </span>
        )}
      </button>

      {expanded && hasContent && (
        <div className="mt-1.5 pl-5" data-testid="collapsible-thinking-content">
          <MarkdownRenderer>{content}</MarkdownRenderer>
        </div>
      )}
    </div>
  );
}
