import React from "react";
import { useTranslation } from "react-i18next";
import { I18nKey } from "#/i18n/declaration";
import { TextShimmer } from "#/components/shared/text-shimmer";

/**
 * Fills the visual gap between settled chat rows while the agent is still
 * working (waiting on the next thought / tool call).
 */
export function AgentInterimStatus() {
  const { t } = useTranslation("openhands");

  return (
    <div
      className="flex items-center gap-2 px-1 py-1"
      data-testid="agent-interim-status"
      role="status"
      aria-live="polite"
    >
      <TextShimmer
        as="span"
        className="text-xs font-medium"
        duration={2.2}
        spread={2}
      >
        {t(I18nKey.CHAT_INTERFACE$PLANNING_NEXT_STEP)}
      </TextShimmer>
    </div>
  );
}
