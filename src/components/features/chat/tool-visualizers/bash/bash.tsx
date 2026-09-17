import React from "react";
import { useTranslation } from "react-i18next";
import { SecurityRisk } from "#/types/agent-server/core";
import { I18nKey } from "#/i18n/declaration";
import { CopyableContentWrapper } from "#/components/shared/buttons/copyable-content-wrapper";
import { defineVisualizer } from "../define";
import { stripSoftWrappedCommandEcho, textFromContent } from "../text-content";

/** Cap the terminal pane so long logs scroll instead of blowing up the chat. */
const TERMINAL_MAX_HEIGHT_CLASS = "max-h-64";

/**
 * Bash / terminal visualizer. Cursor-style: one scrollable terminal pane with
 * the full command, a blank line, then the execution log. Covers both the
 * `execute_bash` and `terminal` tools.
 */
export const bashVisualizer = defineVisualizer({
  actionKinds: ["ExecuteBashAction", "TerminalAction"],
  observationKinds: ["ExecuteBashObservation", "TerminalObservation"],
  Body: function BashBody({ action, observation }) {
    const { t } = useTranslation("openhands");
    const command =
      observation?.observation.command ?? action?.action.command ?? "";
    const risk = action?.security_risk;
    const rawOutput = observation
      ? textFromContent(observation.observation.content)
      : "";
    const output = stripSoftWrappedCommandEcho(rawOutput, command);
    const exitCode = observation?.observation.exit_code;
    const showExitBadge = exitCode != null && exitCode !== 0 && exitCode !== -1;
    const isErrorObservation =
      observation?.observation.kind === "TerminalObservation"
        ? observation.observation.is_error
        : observation?.observation.kind === "ExecuteBashObservation"
          ? observation.observation.error
          : false;

    const logText = output.trim()
      ? output
      : observation
        ? t(I18nKey.OBSERVATION$COMMAND_NO_OUTPUT)
        : "";

    // One pane: command, then a blank line, then the log (Cursor-style).
    const terminalText = [command, logText].filter(Boolean).join("\n\n");
    const copyText = [command, output.trim() || null]
      .filter(Boolean)
      .join("\n\n");

    const scrollRef = React.useRef<HTMLPreElement>(null);

    // Keep the viewport pinned to the latest log lines while output grows.
    React.useLayoutEffect(() => {
      const node = scrollRef.current;
      if (!node) {
        return;
      }
      node.scrollTop = node.scrollHeight;
    }, [terminalText]);

    if (!terminalText) {
      return null;
    }

    return (
      <div className="flex flex-col gap-1.5" data-testid="bash-visualizer-body">
        {(risk === SecurityRisk.HIGH || risk === SecurityRisk.MEDIUM) && (
          <span className="text-xs text-[var(--oh-status-error)]">
            {t(
              risk === SecurityRisk.HIGH
                ? I18nKey.SECURITY$HIGH_RISK
                : I18nKey.SECURITY$MEDIUM_RISK,
            )}
          </span>
        )}
        {showExitBadge && (
          <span className="self-start rounded bg-[var(--oh-status-error)]/15 px-1.5 py-0.5 font-mono text-xs text-[var(--oh-status-error)]">
            {t(I18nKey.OBSERVATION$EXIT_CODE, { code: exitCode })}
          </span>
        )}
        <CopyableContentWrapper text={copyText || terminalText}>
          <pre
            ref={scrollRef}
            data-testid="bash-visualizer-terminal"
            className={`overflow-x-auto overflow-y-auto rounded-lg bg-[var(--oh-surface)] p-3 font-mono text-xs leading-5 whitespace-pre-wrap break-words ${TERMINAL_MAX_HEIGHT_CLASS}`}
          >
            {command ? (
              <span
                data-testid="bash-visualizer-command"
                className="text-[var(--oh-foreground)]"
              >
                {command}
              </span>
            ) : null}
            {command && logText ? "\n\n" : null}
            {logText ? (
              <span
                data-testid="bash-visualizer-output"
                className={
                  isErrorObservation
                    ? "text-[var(--oh-status-error)]"
                    : "text-[var(--oh-muted)]"
                }
              >
                {logText}
              </span>
            ) : null}
          </pre>
        </CopyableContentWrapper>
      </div>
    );
  },
});
