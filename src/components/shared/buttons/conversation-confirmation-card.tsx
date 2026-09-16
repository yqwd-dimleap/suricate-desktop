import { useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { I18nKey } from "#/i18n/declaration";
import { ActionTooltip } from "../action-tooltip";
import { RiskAlert } from "#/components/shared/risk-alert";
import WarningIcon from "#/icons/u-warning.svg?react";
import { useEventMessageStore } from "#/stores/event-message-store";
import { isActionEvent } from "#/types/agent-server/type-guards";
import { useActiveConversation } from "#/hooks/query/use-active-conversation";
import { useRespondToConfirmation } from "#/hooks/mutation/use-respond-to-confirmation";
import { SecurityRisk } from "#/types/agent-server/core/base/common";
import { OpenHandsEvent } from "#/types/agent-server/core";
import { displayErrorToast } from "#/utils/custom-toast-handlers";
import { getEventContent } from "#/components/conversation-events/chat/event-content-helpers/get-event-content";
import { MarkdownRenderer } from "#/components/features/markdown/markdown-renderer";

interface ConversationConfirmationCardProps {
  /** The pending action this card asks the user to approve or reject.
   *  Locating it (and deciding whether the card should render at all) is
   *  the timeline projection's job — this component only submits. */
  event: OpenHandsEvent;
}

/**
 * Inline confirmation card anchored under the tool row awaiting approval.
 *
 * Dismisses immediately on confirm / reject via the buttons or shortcuts
 * (optimistic hide via `submittedEventIds`). Clicks outside the card do
 * nothing — accidental blank clicks must not approve or reject. A failed
 * request rolls the id back so the card can reappear; successful responses
 * leave it hidden.
 */
export function ConversationConfirmationCard({
  event,
}: ConversationConfirmationCardProps) {
  const addSubmittedEventId = useEventMessageStore(
    (state) => state.addSubmittedEventId,
  );
  const removeSubmittedEventId = useEventMessageStore(
    (state) => state.removeSubmittedEventId,
  );
  // Synchronous guard so double-clicks in the same tick cannot submit twice
  // before React Query flips `isPending`.
  const hasSubmittedRef = useRef(false);

  const { t } = useTranslation("openhands");
  const { data: conversation } = useActiveConversation();
  const { mutate: respondToConfirmation, isPending } =
    useRespondToConfirmation();

  const handleConfirmation = useCallback(
    (accept: boolean) => {
      if (hasSubmittedRef.current || isPending || !conversation) {
        return;
      }

      hasSubmittedRef.current = true;

      // Hide the strip immediately so accept / reject feel instant; roll
      // back if the server rejects the response.
      if (event.id !== undefined) {
        addSubmittedEventId(event.id);
      }

      respondToConfirmation(
        {
          conversationId: conversation.id,
          conversationUrl: conversation.conversation_url || "",
          sessionApiKey: conversation.session_api_key,
          accept,
        },
        {
          onError: (error) => {
            hasSubmittedRef.current = false;
            if (event.id !== undefined) {
              removeSubmittedEventId(event.id);
            }
            displayErrorToast(
              error instanceof Error ? error.message : t(I18nKey.ERROR$GENERIC),
            );
          },
        },
      );
    },
    [
      isPending,
      conversation,
      respondToConfirmation,
      event.id,
      addSubmittedEventId,
      removeSubmittedEventId,
      t,
    ],
  );

  useEffect(() => {
    const handleKeyDown = (keyEvent: KeyboardEvent) => {
      // Cancel: Shift+Cmd+Backspace (⇧⌘⌫)
      if (
        keyEvent.shiftKey &&
        keyEvent.metaKey &&
        keyEvent.key === "Backspace"
      ) {
        keyEvent.preventDefault();
        handleConfirmation(false);
      }
      // Continue: Cmd+Enter (⌘↩)
      if (keyEvent.metaKey && keyEvent.key === "Enter") {
        keyEvent.preventDefault();
        handleConfirmation(true);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleConfirmation]);

  const risk = isActionEvent(event)
    ? event.security_risk
    : SecurityRisk.UNKNOWN;
  const isHighRisk = risk === SecurityRisk.HIGH;
  const { title, details } = getEventContent(event);

  return (
    <div
      data-testid="conversation-confirmation-card"
      className="flex flex-col gap-2 pt-4"
    >
      {isHighRisk && (
        <RiskAlert
          content={t(I18nKey.CHAT_INTERFACE$HIGH_RISK_WARNING)}
          icon={<WarningIcon width={16} height={16} color="#fff" />}
          severity="high"
          title={t(I18nKey.COMMON$HIGH_RISK)}
        />
      )}
      <div
        data-testid="conversation-confirmation-action"
        className="rounded-lg border border-[var(--oh-border)] bg-[var(--oh-surface)] px-3 py-2 text-sm text-[var(--oh-foreground)]"
      >
        <div
          data-testid="conversation-confirmation-action-title"
          className="font-normal text-[var(--oh-foreground)]"
        >
          {title}
        </div>
        {details ? (
          <div
            className="mt-2 text-[var(--oh-muted)]"
            data-testid="conversation-confirmation-action-details"
          >
            {typeof details === "string" ? (
              <MarkdownRenderer>{details}</MarkdownRenderer>
            ) : (
              details
            )}
          </div>
        ) : null}
      </div>
      <div className="flex items-center justify-between">
        <p className="text-sm font-normal text-white">
          {t(I18nKey.CHAT_INTERFACE$USER_ASK_CONFIRMATION)}
        </p>
        <div className="flex items-center gap-3">
          <ActionTooltip
            type="reject"
            disabled={isPending}
            onClick={() => handleConfirmation(false)}
          />
          <ActionTooltip
            type="confirm"
            disabled={isPending}
            onClick={() => handleConfirmation(true)}
          />
        </div>
      </div>
    </div>
  );
}
