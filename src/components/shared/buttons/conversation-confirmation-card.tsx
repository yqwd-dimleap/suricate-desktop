import { useCallback, useEffect } from "react";
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

interface ConversationConfirmationCardProps {
  /** The pending action this card asks the user to approve or reject.
   *  Locating it (and deciding whether the card should render at all) is
   *  the timeline projection's job — this component only submits. */
  event: OpenHandsEvent;
}

/**
 * Inline confirmation card anchored under the tool row awaiting approval.
 *
 * Submission life-cycle: both actions (and their keyboard shortcuts) lock
 * while a response is in flight; the event id is recorded as submitted only
 * on success, so a failed request leaves the card interactive instead of
 * hiding it prematurely.
 */
export function ConversationConfirmationCard({
  event,
}: ConversationConfirmationCardProps) {
  const addSubmittedEventId = useEventMessageStore(
    (state) => state.addSubmittedEventId,
  );

  const { t } = useTranslation("openhands");
  const { data: conversation } = useActiveConversation();
  const { mutate: respondToConfirmation, isPending } =
    useRespondToConfirmation();

  const handleConfirmation = useCallback(
    (accept: boolean) => {
      if (isPending || !conversation) {
        return;
      }

      respondToConfirmation(
        {
          conversationId: conversation.id,
          conversationUrl: conversation.conversation_url || "",
          sessionApiKey: conversation.session_api_key,
          accept,
        },
        {
          onSuccess: () => {
            if (event.id) {
              addSubmittedEventId(event.id);
            }
          },
          onError: (error) => {
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
      <div className="flex justify-between items-center">
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
