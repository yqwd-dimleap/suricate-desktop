/**
 * Durations below this threshold settle to Cursor's "Thought briefly"
 * phrasing instead of "Thought Ns".
 */
export const BRIEF_THINKING_THRESHOLD_SECONDS = 2;

export type SettledThinkingLabel =
  | { readonly key: "OBSERVATION_MESSAGE$THINK" }
  | { readonly key: "THINKING$SETTLED_BRIEF" }
  | { readonly key: "THINKING$SETTLED_DURATION"; readonly seconds: number };

/**
 * Cursor-style settled thinking header:
 * - no measured duration → plain "Thought"
 * - &lt; 2s → "Thought briefly"
 * - ≥ 2s → "Thought Ns"
 */
export function getSettledThinkingLabel(
  elapsedSeconds: number | null,
): SettledThinkingLabel {
  if (elapsedSeconds == null) {
    return { key: "OBSERVATION_MESSAGE$THINK" };
  }
  if (elapsedSeconds < BRIEF_THINKING_THRESHOLD_SECONDS) {
    return { key: "THINKING$SETTLED_BRIEF" };
  }
  return { key: "THINKING$SETTLED_DURATION", seconds: elapsedSeconds };
}
