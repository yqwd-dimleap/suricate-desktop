import { useTranslation } from "react-i18next";
import ArrowUpIcon from "#/icons/u-arrow-up.svg?react";
import { cn, getGitPushPrompt } from "#/utils/utils";
import {
  gitControlBarActionButtonClassName,
  gitControlBarActionIconColor,
  gitControlBarActionLabelClassName,
} from "#/utils/git-control-bar-classes";
import { I18nKey } from "#/i18n/declaration";
import { Provider } from "#/types/settings";
import { useTracking } from "#/hooks/use-tracking";
import { useFilesTabStore } from "#/stores/files-tab-store";

interface GitControlBarPushButtonProps {
  onSuggestionsClick: (value: string) => void;
  hasRepository: boolean;
  providerTokensReady: boolean;
  currentGitProvider: Provider;
  isConversationReady?: boolean;
}

export function GitControlBarPushButton({
  onSuggestionsClick,
  hasRepository,
  providerTokensReady,
  currentGitProvider,
  isConversationReady = true,
}: GitControlBarPushButtonProps) {
  const { t } = useTranslation("openhands");
  const { trackPushButtonClick } = useTracking();
  const clearAllStickyReveals = useFilesTabStore(
    (state) => state.clearAllStickyReveals,
  );

  const isButtonEnabled =
    providerTokensReady && hasRepository && isConversationReady;

  const handlePushClick = () => {
    trackPushButtonClick();
    // Push is agent-mediated; clear review highlights when the user asks to
    // publish — working-tree clean-up also clears via git-changes watching.
    clearAllStickyReveals();
    onSuggestionsClick(getGitPushPrompt(currentGitProvider));
  };

  return (
    <button
      type="button"
      onClick={handlePushClick}
      disabled={!isButtonEnabled}
      className={cn(
        gitControlBarActionButtonClassName(isButtonEnabled),
        "px-2 py-1 w-[77px] min-w-[77px]",
      )}
    >
      <div className="w-3 h-3 flex items-center justify-center">
        <ArrowUpIcon
          width={12}
          height={12}
          color={gitControlBarActionIconColor(isButtonEnabled)}
        />
      </div>
      <div
        className={cn(gitControlBarActionLabelClassName, "max-w-[77px]")}
        title={t(I18nKey.COMMON$PUSH)}
      >
        {t(I18nKey.COMMON$PUSH)}
      </div>
    </button>
  );
}
