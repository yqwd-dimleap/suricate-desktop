import { beforeEach, describe, expect, it } from "vitest";
import {
  hasDocumentConflict,
  isDocumentDirty,
  useWorkspaceDocumentStore,
} from "#/stores/workspace-document-store";

const CID = "conv-1";
const PATH = "src/app.ts";

describe("useWorkspaceDocumentStore", () => {
  beforeEach(() => {
    useWorkspaceDocumentStore.getState().reset();
  });

  it("hydrates a clean buffer from disk and follows later remote updates", () => {
    const store = useWorkspaceDocumentStore.getState();
    store.applyRemote(CID, PATH, "v1");
    expect(store.getDocument(CID, PATH)).toEqual({
      baseline: "v1",
      draft: "v1",
      incoming: null,
    });

    useWorkspaceDocumentStore.getState().applyRemote(CID, PATH, "v2");
    expect(useWorkspaceDocumentStore.getState().getDocument(CID, PATH)).toEqual(
      {
        baseline: "v2",
        draft: "v2",
        incoming: null,
      },
    );
  });

  it("keeps dirty drafts across applyRemote and records incoming when disk diverges", () => {
    const store = useWorkspaceDocumentStore.getState();
    store.applyRemote(CID, PATH, "disk");
    store.setDraft(CID, PATH, "mine");

    expect(isDocumentDirty(store.getDocument(CID, PATH))).toBe(true);

    useWorkspaceDocumentStore.getState().applyRemote(CID, PATH, "agent");
    const doc = useWorkspaceDocumentStore.getState().getDocument(CID, PATH);
    expect(doc?.draft).toBe("mine");
    expect(doc?.baseline).toBe("disk");
    expect(doc?.incoming).toBe("agent");
    expect(hasDocumentConflict(doc)).toBe(true);
  });

  it("does not reopen a conflict for a stale refetch of the original baseline", () => {
    const store = useWorkspaceDocumentStore.getState();
    store.applyRemote(CID, PATH, "disk");
    store.setDraft(CID, PATH, "mine");
    store.applyRemote(CID, PATH, "agent");
    store.applyRemote(CID, PATH, "disk");

    expect(store.getDocument(CID, PATH)?.incoming).toBe("agent");
  });

  it("keepMine acknowledges disk and leaves the user draft dirty", () => {
    const store = useWorkspaceDocumentStore.getState();
    store.applyRemote(CID, PATH, "disk");
    store.setDraft(CID, PATH, "mine");
    store.applyRemote(CID, PATH, "agent");
    store.keepMine(CID, PATH);

    const doc = store.getDocument(CID, PATH);
    expect(doc).toEqual({
      baseline: "agent",
      draft: "mine",
      incoming: null,
    });
    expect(isDocumentDirty(doc)).toBe(true);

    store.applyRemote(CID, PATH, "agent");
    expect(store.getDocument(CID, PATH)?.incoming).toBeNull();
  });

  it("useIncoming replaces the draft with the agent snapshot", () => {
    const store = useWorkspaceDocumentStore.getState();
    store.applyRemote(CID, PATH, "disk");
    store.setDraft(CID, PATH, "mine");
    store.applyRemote(CID, PATH, "agent");
    store.useIncoming(CID, PATH);

    expect(store.getDocument(CID, PATH)).toEqual({
      baseline: "agent",
      draft: "agent",
      incoming: null,
    });
  });

  it("keeps dirty buffers when closing a path and drops clean ones", () => {
    const store = useWorkspaceDocumentStore.getState();
    store.applyRemote(CID, PATH, "a");
    store.closePath(CID, PATH);
    expect(store.getDocument(CID, PATH)).toBeUndefined();

    store.applyRemote(CID, PATH, "a");
    store.setDraft(CID, PATH, "b");
    store.closePath(CID, PATH);
    expect(store.getDocument(CID, PATH)?.draft).toBe("b");
  });

  it("isolates documents by conversation and path", () => {
    const store = useWorkspaceDocumentStore.getState();
    store.applyRemote(CID, PATH, "one");
    store.setDraft(CID, PATH, "edit-one");
    store.applyRemote("conv-2", PATH, "two");
    store.applyRemote(CID, "other.ts", "other");

    expect(store.getDocument(CID, PATH)?.draft).toBe("edit-one");
    expect(store.getDocument("conv-2", PATH)?.draft).toBe("two");
    expect(store.getDocument(CID, "other.ts")?.draft).toBe("other");

    store.clearConversation(CID);
    expect(store.getDocument(CID, PATH)).toBeUndefined();
    expect(store.getDocument("conv-2", PATH)?.draft).toBe("two");
  });

  it("auto-clears dirty when the remote snapshot matches the draft", () => {
    const store = useWorkspaceDocumentStore.getState();
    store.applyRemote(CID, PATH, "disk");
    store.setDraft(CID, PATH, "same-as-agent");
    store.applyRemote(CID, PATH, "same-as-agent");

    expect(store.getDocument(CID, PATH)).toEqual({
      baseline: "same-as-agent",
      draft: "same-as-agent",
      incoming: null,
    });
  });

  it("updates incoming when the agent writes again during an open conflict", () => {
    const store = useWorkspaceDocumentStore.getState();
    store.applyRemote(CID, PATH, "disk");
    store.setDraft(CID, PATH, "mine");
    store.applyRemote(CID, PATH, "agent-v1");
    store.applyRemote(CID, PATH, "agent-v2");

    expect(store.getDocument(CID, PATH)).toEqual({
      baseline: "disk",
      draft: "mine",
      incoming: "agent-v2",
    });
  });

  it("markSynced clears dirty and conflict after a successful save", () => {
    const store = useWorkspaceDocumentStore.getState();
    store.applyRemote(CID, PATH, "disk");
    store.setDraft(CID, PATH, "mine");
    store.applyRemote(CID, PATH, "agent");
    store.markSynced(CID, PATH, "mine");

    expect(store.getDocument(CID, PATH)).toEqual({
      baseline: "mine",
      draft: "mine",
      incoming: null,
    });
  });

  it("preserves conflicted buffers when the tab is closed", () => {
    const store = useWorkspaceDocumentStore.getState();
    store.applyRemote(CID, PATH, "disk");
    store.setDraft(CID, PATH, "mine");
    store.applyRemote(CID, PATH, "agent");
    store.closePath(CID, PATH);

    expect(store.getDocument(CID, PATH)?.incoming).toBe("agent");
    expect(store.getDocument(CID, PATH)?.draft).toBe("mine");
  });

  it("setDraft is a no-op until applyRemote has hydrated the path", () => {
    const store = useWorkspaceDocumentStore.getState();
    store.setDraft(CID, PATH, "orphan");
    expect(store.getDocument(CID, PATH)).toBeUndefined();
  });

  it("typing the incoming text while conflicted resolves to a clean buffer", () => {
    const store = useWorkspaceDocumentStore.getState();
    store.applyRemote(CID, PATH, "disk");
    store.setDraft(CID, PATH, "mine");
    store.applyRemote(CID, PATH, "agent");
    store.setDraft(CID, PATH, "agent");

    expect(store.getDocument(CID, PATH)).toEqual({
      baseline: "agent",
      draft: "agent",
      incoming: null,
    });
  });
});
