import { beforeEach, describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../../../../test-utils";
import { HunkReviewOverlay } from "#/components/features/files-tab/hunk-review-overlay";
import { useAgentReviewStore } from "#/stores/agent-review-store";

describe("HunkReviewOverlay", () => {
  beforeEach(() => {
    useAgentReviewStore.getState().reset();
  });

  it("renders Accept/Reject for pending hunks and Accept removes the row", async () => {
    useAgentReviewStore.getState().openCheckpoint("test-conversation-id", "msg-1");
    useAgentReviewStore.getState().ingestObservation({
      conversationId: "test-conversation-id",
      checkpointId: "msg-1",
      path: "app.ts",
      baseline: "a\nOLD\nc",
      current: "a\nNEW\nc",
      prevExist: true,
    });

    const user = userEvent.setup();
    renderWithProviders(<HunkReviewOverlay path="app.ts" dirty={false} />);

    expect(screen.getByTestId("hunk-review-overlay")).toBeInTheDocument();
    expect(screen.getByTestId("hunk-accept")).toBeInTheDocument();
    await user.click(screen.getByTestId("hunk-accept"));
    expect(screen.queryByTestId("hunk-review-overlay")).not.toBeInTheDocument();
  });
});
