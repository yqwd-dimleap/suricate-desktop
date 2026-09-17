import React from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronRight } from "lucide-react";
import { SuccessIndicator } from "./success-indicator";
import { ObservationResultStatus } from "#/components/conversation-events/chat/event-content-helpers/get-observation-result";
import { MarkdownRenderer } from "../markdown/markdown-renderer";
import { cn } from "#/utils/utils";
import { I18nKey } from "#/i18n/declaration";
import { StyledTooltip } from "#/components/shared/buttons/styled-tooltip";
import { formatEventTimestamp } from "#/utils/format-event-timestamp";

interface GenericEventMessageProps {
  title: React.ReactNode;
  details: string | React.ReactNode;
  success?: ObservationResultStatus;
  initiallyExpanded?: boolean;
  /**
   * Where to place the expand chevron. `"after"` (default) pins it to the
   * right edge of the row (Cursor-style). `"before"` keeps it left of the
   * title for legacy surfaces like BTW / goal status.
   */
  chevronPosition?: "before" | "after";
  /** Extra content rendered at the end of the title row (right side). */
  titleTrailing?: React.ReactNode;
  /** Optional icon rendered before the title text. */
  titleIcon?: React.ReactNode;
  timestamp?: string;
}

export function GenericEventMessage({
  title,
  details,
  success,
  initiallyExpanded = false,
  chevronPosition = "after",
  titleTrailing,
  titleIcon,
  timestamp,
}: GenericEventMessageProps) {
  const { t, i18n } = useTranslation("openhands");
  const [showDetails, setShowDetails] = React.useState(initiallyExpanded);
  const [isHovered, setIsHovered] = React.useState(false);
  const [hasFocusWithin, setHasFocusWithin] = React.useState(false);
  const timestampLabel = formatEventTimestamp(timestamp, i18n?.language);

  const toggleDetails = (
    event: React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>,
  ) => {
    if (!details) {
      return;
    }
    setShowDetails((prev) => !prev);
    if ("detail" in event && event.detail > 0) {
      setIsHovered(false);
      event.currentTarget.blur();
    }
  };

  const ChevronIcon = showDetails ? ChevronDown : ChevronRight;
  const chevron = details ? (
    <ChevronIcon
      aria-hidden
      className={cn(
        "inline h-4 w-4 text-[var(--oh-muted)]",
        chevronPosition === "before" && "mr-2",
      )}
    />
  ) : null;

  const expandButton =
    details && chevronPosition === "after" ? (
      <button
        type="button"
        data-testid="generic-event-message-expand"
        className="rounded p-0.5 text-[var(--oh-muted)] hover:bg-[var(--oh-interactive-hover)] hover:text-[var(--oh-foreground)]"
        aria-expanded={showDetails}
        aria-label={
          showDetails ? t(I18nKey.BUTTON$COLLAPSE) : t(I18nKey.BUTTON$EXPAND)
        }
        onClick={toggleDetails}
      >
        {chevron}
      </button>
    ) : null;

  const titleContent = (
    <div
      data-testid="generic-event-message-title"
      role={details ? "button" : undefined}
      tabIndex={details ? 0 : undefined}
      aria-expanded={details ? showDetails : undefined}
      aria-label={
        details
          ? showDetails
            ? t(I18nKey.BUTTON$COLLAPSE)
            : t(I18nKey.BUTTON$EXPAND)
          : undefined
      }
      className={cn(
        "flex items-center min-w-0",
        details && "cursor-pointer text-left",
      )}
      onClick={details ? toggleDetails : undefined}
      onKeyDown={
        details
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                toggleDetails(event);
              }
            }
          : undefined
      }
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocusCapture={() => setHasFocusWithin(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setHasFocusWithin(false);
        }
      }}
    >
      {chevronPosition === "before" && chevron}
      {titleIcon}
      {/* Wrap the title in a span so any whitespace inside Trans-rendered
          fragments (e.g. "Editing <path>...</path>") is preserved by
          normal inline flow instead of being collapsed between
          anonymous flex items. */}
      <span className="truncate">{title}</span>
    </div>
  );

  const titleContentWithTimestamp = timestampLabel ? (
    <StyledTooltip
      content={<time dateTime={timestamp}>{timestampLabel}</time>}
      placement="top"
      isOpen={isHovered || hasFocusWithin}
    >
      {titleContent}
    </StyledTooltip>
  ) : (
    titleContent
  );

  const titleRow = (
    <div className="flex w-full min-w-0 items-center gap-1.5 font-normal text-[var(--oh-muted)]">
      {/* Title + chevron stay adjacent (Cursor-style compact row), matching
          the file-edit summary. Trailing/success can still sit on the right. */}
      <div className="flex min-w-0 items-center gap-1">
        {titleContentWithTimestamp}
        {expandButton}
      </div>
      {(titleTrailing || success) && (
        <div className="ml-auto flex shrink-0 items-center gap-1">
          {titleTrailing}
          {success && <SuccessIndicator status={success} />}
        </div>
      )}
    </div>
  );

  return (
    <div className="flex flex-col gap-1.5 my-1 py-1 text-sm w-full">
      {titleRow}
      {showDetails &&
        (typeof details === "string" ? (
          <MarkdownRenderer>{details}</MarkdownRenderer>
        ) : (
          details
        ))}
    </div>
  );
}
