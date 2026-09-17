import { beforeEach, describe, expect, it } from "vitest";
import { useAgentReviewStore } from "#/stores/agent-review-store";

const CID = "conv-1";

describe("useAgentReviewStore", () => {
  beforeEach(() => {
    useAgentReviewStore.getState().reset();
  });

  it("records a checkpoint snapshot only on first ingest for a path", () => {
    const store = useAgentReviewStore.getState();
    store.openCheckpoint(CID, "msg-1");
    store.ingestObservation({
      conversationId: CID,
      checkpointId: "msg-1",
      path: "a.ts",
      baseline: "old",
      current: "new",
      prevExist: true,
    });
    store.ingestObservation({
      conversationId: CID,
      checkpointId: "msg-1",
      path: "a.ts",
      baseline: "new",
      current: "newer",
      prevExist: true,
    });

    const checkpoint = useAgentReviewStore.getState().getCheckpoint(CID, "msg-1");
    expect(checkpoint?.files["a.ts"]?.baseline).toBe("old");
    const pending = useAgentReviewStore.getState().getPendingFile(CID, "a.ts");
    expect(pending?.baseline).toBe("old");
    expect(pending?.current).toBe("newer");
    expect(pending?.hunks.some((hunk) => hunk.status === "pending")).toBe(true);
  });

  it("acceptHunk removes the file from pending when no pending hunks remain", () => {
    useAgentReviewStore.getState().openCheckpoint(CID, "msg-1");
    useAgentReviewStore.getState().ingestObservation({
      conversationId: CID,
      checkpointId: "msg-1",
      path: "a.ts",
      baseline: "a\nOLD\nc",
      current: "a\nNEW\nc",
      prevExist: true,
    });
    const hunkId = useAgentReviewStore.getState().getPendingFile(CID, "a.ts")
      ?.hunks[0]?.id;
    expect(hunkId).toBeDefined();
    useAgentReviewStore.getState().acceptHunk(CID, "a.ts", hunkId!);
    expect(
      useAgentReviewStore.getState().getPendingFile(CID, "a.ts"),
    ).toBeUndefined();
    expect(useAgentReviewStore.getState().getPendingFiles(CID)).toHaveLength(0);
  });

  it("acceptAll clears every pending file in the conversation", () => {
    useAgentReviewStore.getState().openCheckpoint(CID, "msg-1");
    useAgentReviewStore.getState().ingestObservation({
      conversationId: CID,
      checkpointId: "msg-1",
      path: "a.ts",
      baseline: "1",
      current: "2",
      prevExist: true,
    });
    useAgentReviewStore.getState().ingestObservation({
      conversationId: CID,
      checkpointId: "msg-1",
      path: "b.ts",
      baseline: "1",
      current: "2",
      prevExist: true,
    });
    useAgentReviewStore.getState().acceptAll(CID);
    expect(useAgentReviewStore.getState().getPendingFiles(CID)).toHaveLength(0);
  });
});
