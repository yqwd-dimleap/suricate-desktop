import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../../../../test-utils";
import { EditableSourceView } from "#/components/features/files-tab/editable-source-view";
import { useWorkspaceDocumentStore } from "#/stores/workspace-document-store";
import { useFilesTabStore } from "#/stores/files-tab-store";

/* eslint-disable i18next/no-literal-string -- editor fixture bodies, not UI copy */

const mutateMock = vi.fn();

vi.mock("#/hooks/mutation/use-save-workspace-text-file", () => ({
  useSaveWorkspaceTextFile: () => ({
    mutate: mutateMock,
    isPending: false,
  }),
}));

vi.mock("#/hooks/query/use-unified-get-git-changes", () => ({
  useUnifiedGetGitChanges: () => ({
    data: [],
    isSuccess: true,
    isLoading: false,
  }),
}));

vi.mock("#/hooks/query/use-unified-git-diff", () => ({
  useUnifiedGitDiff: () => ({
    data: undefined,
    isSuccess: false,
  }),
}));

vi.mock("#/hooks/query/use-git-blame", () => ({
  useGitBlame: () => ({
    lines: [
      {
        line: 1,
        sha: "abc",
        author: "alice",
        authorTime: "2026-09-17T10:00:00+08:00",
        summary: "work",
      },
    ],
    isUnsupported: false,
  }),
}));

type FakeAction = {
  id: string;
  label: string;
  precondition?: string;
  run: () => void;
  dispose: () => void;
};

const registeredActions: FakeAction[] = [];
const contextKeys = new Map<string, { value: boolean; set: (v: boolean) => void }>();

function createFakeEditor() {
  return {
    addCommand: vi.fn(),
    createContextKey: (key: string, defaultValue: boolean) => {
      const entry = {
        value: defaultValue,
        set: (next: boolean) => {
          entry.value = next;
        },
      };
      contextKeys.set(key, entry);
      return entry;
    },
    addAction: (descriptor: {
      id: string;
      label: string;
      precondition?: string;
      run: () => void;
    }) => {
      const action: FakeAction = {
        id: descriptor.id,
        label: descriptor.label,
        precondition: descriptor.precondition,
        run: descriptor.run,
        dispose: vi.fn(),
      };
      registeredActions.push(action);
      return action;
    },
    deltaDecorations: () => [],
    revealLineInCenter: vi.fn(),
    setPosition: vi.fn(),
    getScrollTop: () => 0,
    getLayoutInfo: () => ({ height: 400 }),
    getTopForLineNumber: (line: number) => (line - 1) * 20,
    getBottomForLineNumber: (line: number) => line * 20,
    onDidScrollChange: () => ({ dispose: vi.fn() }),
    onDidLayoutChange: () => ({ dispose: vi.fn() }),
    onDidContentSizeChange: () => ({ dispose: vi.fn() }),
    onDidChangeConfiguration: () => ({ dispose: vi.fn() }),
  };
}

vi.mock("@monaco-editor/react", () => ({
  Editor: ({
    value,
    onChange,
    onMount,
  }: {
    value: string;
    onChange?: (value: string | undefined) => void;
    onMount?: (editor: ReturnType<typeof createFakeEditor>, monaco: object) => void;
  }) => {
    React.useEffect(() => {
      onMount?.(createFakeEditor(), {
        KeyMod: { CtrlCmd: 2048 },
        KeyCode: { KeyS: 49 },
      });
      // eslint-disable-next-line react-hooks/exhaustive-deps -- mount once
    }, []);
    return (
      <textarea
        data-testid="monaco-editor"
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
      />
    );
  },
}));

const CID = "test-conversation-id";
const PATH = "src/app.ts";

function setEditorValue(value: string) {
  fireEvent.change(screen.getByTestId("monaco-editor"), {
    target: { value },
  });
}

describe("EditableSourceView", () => {
  beforeEach(() => {
    mutateMock.mockReset();
    registeredActions.length = 0;
    contextKeys.clear();
    useWorkspaceDocumentStore.getState().reset();
    useFilesTabStore.setState({
      isAnnotateEnabled: false,
      isAnnotateUnsupported: false,
    });
  });

  it("keeps unsaved drafts after unmount so switching tabs does not drop edits", () => {
    const { unmount } = renderWithProviders(
      <EditableSourceView path={PATH} text="hello" />,
    );

    setEditorValue("hello world");
    expect(screen.getByTestId("editable-source-unsaved")).toBeInTheDocument();
    unmount();

    renderWithProviders(<EditableSourceView path={PATH} text="hello" />);
    expect(screen.getByTestId("monaco-editor")).toHaveValue("hello world");
    expect(screen.getByTestId("editable-source-unsaved")).toBeInTheDocument();
  });

  it("does not overwrite a dirty draft when disk text changes; use agent resolves it", async () => {
    const user = userEvent.setup();
    const { rerender } = renderWithProviders(
      <EditableSourceView path={PATH} text="disk" />,
    );

    setEditorValue("mine");

    rerender(<EditableSourceView path={PATH} text="agent" />);
    expect(screen.getByTestId("editable-source-conflict")).toBeInTheDocument();
    expect(screen.getByTestId("monaco-editor")).toHaveValue("mine");

    await user.click(screen.getByTestId("editable-source-use-incoming"));
    expect(
      screen.queryByTestId("editable-source-conflict"),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("monaco-editor")).toHaveValue("agent");
  });

  it("blocks save while a conflict is open", async () => {
    const user = userEvent.setup();
    const { rerender } = renderWithProviders(
      <EditableSourceView path={PATH} text="disk" />,
    );
    setEditorValue("mine");
    rerender(<EditableSourceView path={PATH} text="agent" />);

    await user.click(screen.getByTestId("editable-source-save"));
    expect(mutateMock).not.toHaveBeenCalled();
    expect(screen.getByTestId("editable-source-save")).toBeDisabled();
  });

  it("saves the store draft for the open path", async () => {
    const user = userEvent.setup();
    renderWithProviders(<EditableSourceView path={PATH} text="hello" />);
    setEditorValue("hello world");
    await user.click(screen.getByTestId("editable-source-save"));

    expect(mutateMock).toHaveBeenCalledWith(
      { relativePath: PATH, content: "hello world" },
      expect.any(Object),
    );
    expect(
      useWorkspaceDocumentStore.getState().getDocument(CID, PATH)?.draft,
    ).toBe("hello world");
  });

  it("follows agent disk updates live when the buffer is clean", () => {
    const { rerender } = renderWithProviders(
      <EditableSourceView path={PATH} text="v1" />,
    );
    expect(screen.getByTestId("monaco-editor")).toHaveValue("v1");
    expect(
      screen.queryByTestId("editable-source-unsaved"),
    ).not.toBeInTheDocument();

    rerender(<EditableSourceView path={PATH} text="v2-from-agent" />);
    expect(screen.getByTestId("monaco-editor")).toHaveValue("v2-from-agent");
    expect(
      screen.queryByTestId("editable-source-conflict"),
    ).not.toBeInTheDocument();
  });

  it("keep mine acknowledges agent disk and leaves the draft dirty", async () => {
    const user = userEvent.setup();
    const { rerender } = renderWithProviders(
      <EditableSourceView path={PATH} text="disk" />,
    );
    setEditorValue("mine");
    rerender(<EditableSourceView path={PATH} text="agent" />);

    await user.click(screen.getByTestId("editable-source-keep-mine"));
    expect(
      screen.queryByTestId("editable-source-conflict"),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("monaco-editor")).toHaveValue("mine");
    expect(screen.getByTestId("editable-source-unsaved")).toBeInTheDocument();
    expect(screen.getByTestId("editable-source-save")).not.toBeDisabled();
  });

  it("restores a dirty draft when switching between open files", () => {
    const { rerender } = renderWithProviders(
      <EditableSourceView path="a.ts" text="aaa" />,
    );
    setEditorValue("aaa-edit");

    rerender(<EditableSourceView path="b.ts" text="bbb" />);
    expect(screen.getByTestId("monaco-editor")).toHaveValue("bbb");

    rerender(<EditableSourceView path="a.ts" text="aaa" />);
    expect(screen.getByTestId("monaco-editor")).toHaveValue("aaa-edit");
    expect(screen.getByTestId("editable-source-unsaved")).toBeInTheDocument();
  });

  it("registers Annotate / Close Annotations context-menu actions", async () => {
    renderWithProviders(<EditableSourceView path={PATH} text="hello" />);

    await waitFor(() => {
      expect(registeredActions.map((action) => action.id)).toEqual([
        "files.annotateWithGitBlame",
        "files.closeAnnotations",
      ]);
    });

    registeredActions
      .find((action) => action.id === "files.annotateWithGitBlame")
      ?.run();
    expect(useFilesTabStore.getState().isAnnotateEnabled).toBe(true);
    await waitFor(() => {
      expect(contextKeys.get("filesGitBlameAnnotateEnabled")?.value).toBe(true);
    });
    await waitFor(() => {
      expect(screen.getByTestId("git-blame-gutter")).toBeInTheDocument();
    });

    registeredActions
      .find((action) => action.id === "files.closeAnnotations")
      ?.run();
    expect(useFilesTabStore.getState().isAnnotateEnabled).toBe(false);
    await waitFor(() => {
      expect(contextKeys.get("filesGitBlameAnnotateEnabled")?.value).toBe(
        false,
      );
    });
    await waitFor(() => {
      expect(screen.queryByTestId("git-blame-gutter")).not.toBeInTheDocument();
    });
  });
});
