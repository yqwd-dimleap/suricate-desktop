import { describe, expect, it } from "vitest";
import {
  BRIEF_THINKING_THRESHOLD_SECONDS,
  getSettledThinkingLabel,
} from "#/components/conversation-events/chat/event-message-components/settled-thinking-label";

describe("getSettledThinkingLabel", () => {
  it("uses Thought briefly when duration was never measured", () => {
    expect(getSettledThinkingLabel(null)).toEqual({
      key: "THINKING$SETTLED_BRIEF",
    });
  });

  it.each([0, 1])(
    "uses Thought briefly when elapsed is %s (< threshold)",
    (seconds) => {
      expect(seconds).toBeLessThan(BRIEF_THINKING_THRESHOLD_SECONDS);
      expect(getSettledThinkingLabel(seconds)).toEqual({
        key: "THINKING$SETTLED_BRIEF",
      });
    },
  );

  it.each([2, 3, 28])(
    "uses Thought Ns when elapsed is %s (≥ threshold)",
    (seconds) => {
      expect(getSettledThinkingLabel(seconds)).toEqual({
        key: "THINKING$SETTLED_DURATION",
        seconds,
      });
    },
  );
});
