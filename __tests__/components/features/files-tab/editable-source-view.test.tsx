import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../../../../test-utils";
import { EditableSourceView } from "#/components/features/files-tab/editable-source-view";
import { useWorkspaceDocumentStore } from "#/stores/workspace-document-store";

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

vi.mock("@monaco-editor/react", () => ({
  Editor: ({
    value,
    onChange,
  }: {
    value: string;
    onChange?: (value: string | undefined) => void;
  }) => (
    <textarea
      data-testid="monaco-editor"
      value={value}
      onChange={(event) => onChange?.(event.target.value)}
    />
  ),
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
    useWorkspaceDocumentStore.getState().reset();
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
});
