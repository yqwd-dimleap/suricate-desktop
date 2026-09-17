/**
 * Durations below this threshold settle to Cursor's "Thought briefly"
 * phrasing instead of "Thought Ns".
 */
export const BRIEF_THINKING_THRESHOLD_SECONDS = 2;

export type SettledThinkingLabel =
  | { readonly key: "THINKING$SETTLED_BRIEF" }
  | { readonly key: "THINKING$SETTLED_DURATION"; readonly seconds: number };

/**
 * Cursor-style settled thinking header:
 * - no measured duration → "Thought briefly" (historical / ActionEvent.thought
 *   that never streamed through a live timer)
 * - &lt; 2s → "Thought briefly"
 * - ≥ 2s → "Thought Ns"
 */
export function getSettledThinkingLabel(
  elapsedSeconds: number | null,
): SettledThinkingLabel {
  if (
    elapsedSeconds == null ||
    elapsedSeconds < BRIEF_THINKING_THRESHOLD_SECONDS
  ) {
    return { key: "THINKING$SETTLED_BRIEF" };
  }
  return { key: "THINKING$SETTLED_DURATION", seconds: elapsedSeconds };
}
