import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";

import { FileTreeView } from "#/components/features/files-tab/file-tree-view";

// FileTreeView composes the recursive TreeNode (extracted into its own file).
// The route-level files-tab test treats the tree as a black box, so these
// cover the tree's own user-facing behavior: empty state, directory
// expand/collapse, and file selection.
describe("FileTreeView", () => {
  it("shows the empty-state message and no tree when there are no files", () => {
    // Arrange + Act
    render(
      <FileTreeView paths={[]} selectedPath={null} onSelectFile={vi.fn()} />,
    );

    // Assert
    expect(screen.getByText("FILES$NO_FILES")).toBeInTheDocument();
    expect(screen.queryByTestId("file-tree-view")).not.toBeInTheDocument();
  });

  it("keeps a directory collapsed until clicked, then reveals its children", async () => {
    // Arrange
    const user = userEvent.setup();
    render(
      <FileTreeView
        paths={["src/main.ts"]}
        selectedPath={null}
        onSelectFile={vi.fn()}
      />,
    );

    // Assert: the directory row shows but its nested file is hidden.
    expect(screen.getByTestId("file-tree-dir-src")).toBeInTheDocument();
    expect(
      screen.queryByTestId("file-tree-file-src/main.ts"),
    ).not.toBeInTheDocument();

    // Act: expand the directory.
    await user.click(screen.getByTestId("file-tree-dir-src"));

    // Assert: the nested file is now visible.
    expect(
      screen.getByTestId("file-tree-file-src/main.ts"),
    ).toBeInTheDocument();
  });

  it("calls onSelectFile with the file path when a file row is clicked", async () => {
    // Arrange
    const user = userEvent.setup();
    const onSelectFile = vi.fn();
    render(
      <FileTreeView
        paths={["README.md"]}
        selectedPath={null}
        onSelectFile={onSelectFile}
      />,
    );

    // Act
    await user.click(screen.getByTestId("file-tree-file-README.md"));

    // Assert
    expect(onSelectFile).toHaveBeenCalledTimes(1);
    expect(onSelectFile).toHaveBeenCalledWith("README.md");
  });

  it("shows Cursor-style M / U / D badges from statusByPath", async () => {
    const user = userEvent.setup();
    const statusByPath = new Map([
      ["src/a.ts", "M" as const],
      ["src/b.ts", "A" as const],
      ["src/c.ts", "D" as const],
    ]);

    render(
      <FileTreeView
        paths={["src/a.ts", "src/b.ts", "src/c.ts"]}
        selectedPath={null}
        onSelectFile={vi.fn()}
        statusByPath={statusByPath}
      />,
    );

    await user.click(screen.getByTestId("file-tree-dir-src"));

    expect(screen.getByTestId("file-tree-git-status-src/a.ts")).toHaveTextContent(
      "M",
    );
    expect(screen.getByTestId("file-tree-git-status-src/a.ts")).toHaveAttribute(
      "data-git-status",
      "M",
    );
    expect(screen.getByTestId("file-tree-git-status-src/b.ts")).toHaveTextContent(
      "U",
    );
    expect(screen.getByTestId("file-tree-git-status-src/b.ts")).toHaveAttribute(
      "data-git-status",
      "A",
    );
    expect(screen.getByTestId("file-tree-git-status-src/c.ts")).toHaveTextContent(
      "D",
    );
  });
});
