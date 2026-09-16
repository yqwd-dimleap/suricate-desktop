import { beforeEach, describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ConversationService from "#/api/conversation-service/conversation-service.api";
import { fileEditorVisualizer } from "#/components/features/chat/tool-visualizers/file-editor/file-editor";
import { useConversationStore } from "#/stores/conversation-store";
import { useFilesTabStore } from "#/stores/files-tab-store";
import {
  renderVisualizer,
  fileEditorAction,
  fileEditorObservation,
} from "../test-utils";

vi.mock("#/hooks/query/use-active-conversation", () => ({
  useActiveConversation: () => ({
    data: {
      id: "test-conversation-id",
      workspace: { working_dir: "/workspace" },
    },
    isFetched: true,
  }),
}));

const Body = fileEditorVisualizer.Body;

describe("fileEditorVisualizer", () => {
  beforeEach(() => {
    ConversationService.setCurrentConversation({
      id: "test-conversation-id",
      workspace: { working_dir: "/workspace" },
    } as never);
    useConversationStore.setState({
      hasRightPanelToggled: false,
      selectedTab: "terminal",
      commitsAutoExpandSection: null,
      commitsAutoExpandPath: null,
      isRightPanelShown: false,
    });
    useFilesTabStore.setState({
      selectedPath: null,
      selectedConversationId: null,
      openPaths: [],
      stickyReveals: {},
    });
  });

  it("shows path and content for a create action", () => {
    const { container } = renderVisualizer(
      <Body
        action={fileEditorAction({
          command: "create",
          path: "/workspace/app.ts",
          file_text: "const x = 1;",
        })}
      />,
    );
    expect(container).toHaveTextContent("/workspace/app.ts");
    expect(container).toHaveTextContent("const x = 1;");
  });

  it("shows the path with a line range for a view action", () => {
    const { container } = renderVisualizer(
      <Body
        action={fileEditorAction({
          command: "view",
          path: "/workspace/app.ts",
          view_range: [1, 10],
        })}
      />,
    );
    expect(container).toHaveTextContent("/workspace/app.ts:1-10");
  });

  it("shows the file snippet the agent saw for a view observation", () => {
    const { container } = renderVisualizer(
      <Body
        observation={fileEditorObservation({
          command: "view",
          content: [
            {
              type: "text",
              text: "Here's the result of running `cat -n`:\n     1\tconst x = 1;",
            },
          ],
        })}
      />,
    );
    expect(container).toHaveTextContent("const x = 1;");
  });

  it("renders a Cursor-style review card for an edit observation", () => {
    renderVisualizer(
      <Body
        observation={fileEditorObservation({
          command: "str_replace",
          path: "/workspace/app.ts",
          old_content: "line one\nOLD\nline three",
          new_content: "line one\nNEW\nline three",
        })}
      />,
    );
    expect(screen.getByTestId("file-editor-review-card")).toBeInTheDocument();
    expect(screen.getByTestId("file-editor-review-filename")).toHaveTextContent(
      "app.ts",
    );
    expect(screen.getByTestId("file-editor-review-stats")).toHaveTextContent(
      "+1",
    );
    expect(screen.getByTestId("file-editor-review-stats")).toHaveTextContent(
      "-1",
    );
    expect(screen.queryByTestId("file-path-chip")).not.toBeInTheDocument();
    expect(screen.queryByTestId("open-in-changes")).not.toBeInTheDocument();
    expect(screen.getByTestId("diff-view")).toHaveTextContent("OLD");
    expect(screen.getByTestId("diff-view")).toHaveTextContent("NEW");
  });

  it("offers Keep and Revert on mutating edit observations", async () => {
    const user = userEvent.setup();
    renderVisualizer(
      <Body
        observation={fileEditorObservation({
          command: "str_replace",
          path: "/workspace/app.ts",
          old_content: "a",
          new_content: "b",
          prev_exist: true,
        })}
      />,
    );

    expect(screen.getByTestId("file-editor-keep-button")).toBeInTheDocument();
    expect(screen.getByTestId("file-editor-revert-button")).toBeInTheDocument();

    await user.click(screen.getByTestId("file-editor-keep-button"));

    expect(
      screen.queryByTestId("file-editor-keep-button"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("file-editor-revert-button"),
    ).not.toBeInTheDocument();
  });

  it("hides Keep/Revert for view observations", () => {
    renderVisualizer(
      <Body
        observation={fileEditorObservation({
          command: "view",
          content: [
            {
              type: "text",
              text: "1\tconst x = 1;",
            },
          ],
        })}
      />,
    );

    expect(
      screen.queryByTestId("file-editor-review-card"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("file-editor-keep-button"),
    ).not.toBeInTheDocument();
  });

  it("renders a diff when clearing a file (new_content is an empty string)", () => {
    renderVisualizer(
      <Body
        observation={fileEditorObservation({
          command: "str_replace",
          old_content: "keep\nremove me",
          new_content: "",
        })}
      />,
    );
    // The empty `new_content` must not short-circuit the diff to the fallback.
    expect(screen.getByTestId("diff-view")).toHaveTextContent("keep");
    expect(screen.getByTestId("diff-view")).toHaveTextContent("remove me");
  });

  it("renders a diff when inserting into an empty file (old_content is an empty string)", () => {
    renderVisualizer(
      <Body
        observation={fileEditorObservation({
          command: "insert",
          old_content: "",
          new_content: "first line\nsecond line",
        })}
      />,
    );
    expect(screen.getByTestId("diff-view")).toHaveTextContent("first line");
    expect(screen.getByTestId("diff-view")).toHaveTextContent("second line");
  });

  it("renders the inserted text for an in-flight insert action (no old_str)", () => {
    renderVisualizer(
      <Body
        action={fileEditorAction({
          command: "insert",
          path: "/workspace/app.ts",
          new_str: "inserted line",
          insert_line: 3,
        })}
      />,
    );
    // Inserts carry `new_str` only; the card must show it, not just the path.
    expect(screen.getByTestId("file-editor-review-filename")).toHaveTextContent(
      "app.ts",
    );
    expect(screen.getByTestId("diff-view")).toHaveTextContent("inserted line");
    expect(
      screen.queryByTestId("file-editor-keep-button"),
    ).not.toBeInTheDocument();
  });

  it("renders a diff for an in-flight str_replace action", () => {
    renderVisualizer(
      <Body
        action={fileEditorAction({
          command: "str_replace",
          path: "/workspace/app.ts",
          old_str: "OLD",
          new_str: "NEW",
        })}
      />,
    );
    expect(screen.getByTestId("diff-view")).toHaveTextContent("OLD");
    expect(screen.getByTestId("diff-view")).toHaveTextContent("NEW");
  });

  it("renders the error message for a failed edit (error state)", () => {
    renderVisualizer(
      <Body
        observation={fileEditorObservation({
          command: "str_replace",
          error: "No replacement performed",
        })}
      />,
    );
    expect(screen.getByText("No replacement performed")).toBeInTheDocument();
  });

  it("opens the generated file in the right drawer when its filename is clicked", async () => {
    const user = userEvent.setup();
    renderVisualizer(
      <Body
        observation={fileEditorObservation({
          command: "create",
          path: "/workspace/app.ts",
          new_content: "const x = 1;",
        })}
      />,
    );

    await user.click(screen.getByTestId("file-editor-review-filename"));

    expect(useFilesTabStore.getState()).toMatchObject({
      selectedPath: "app.ts",
      selectedConversationId: "test-conversation-id",
      stickyReveals: {
        "app.ts": expect.objectContaining({
          startLine: 1,
          endLine: 1,
        }),
      },
    });
    expect(useConversationStore.getState()).toMatchObject({
      hasRightPanelToggled: true,
      selectedTab: "files",
    });
  });

  it("reveals the changed line range when opening an edit from the review card", async () => {
    const user = userEvent.setup();
    renderVisualizer(
      <Body
        observation={fileEditorObservation({
          command: "str_replace",
          path: "/workspace/app.ts",
          old_content: "one\ntwo\nthree\n",
          new_content: "one\nTWO\nthree\n",
          prev_exist: true,
        })}
      />,
    );

    await user.click(screen.getByTestId("file-editor-review-filename"));

    expect(useFilesTabStore.getState().stickyReveals["app.ts"]).toEqual(
      expect.objectContaining({
        startLine: 2,
        endLine: 2,
      }),
    );
  });

  it("clears the sticky highlight when Keep is clicked", async () => {
    const user = userEvent.setup();
    renderVisualizer(
      <Body
        observation={fileEditorObservation({
          command: "str_replace",
          path: "/workspace/app.ts",
          old_content: "a",
          new_content: "b",
          prev_exist: true,
        })}
      />,
    );

    await user.click(screen.getByTestId("file-editor-review-filename"));
    expect(useFilesTabStore.getState().stickyReveals["app.ts"]).toBeDefined();

    await user.click(screen.getByTestId("file-editor-keep-button"));
    expect(useFilesTabStore.getState().stickyReveals["app.ts"]).toBeUndefined();
  });

  it("keeps markdown view observations as a CodeBlock, not a rich preview", () => {
    const { container } = renderVisualizer(
      <Body
        observation={fileEditorObservation({
          command: "view",
          path: "/workspace/README.md",
          content: [
            {
              type: "text",
              text: "Here's the result of running `cat -n`:\n     1\t# README",
            },
          ],
        })}
      />,
    );

    expect(
      screen.queryByTestId("markdown-file-preview"),
    ).not.toBeInTheDocument();
    expect(container).toHaveTextContent("# README");
  });

  it("renders a height-clipped markdown preview with a View bar for .md creates", async () => {
    const user = userEvent.setup();
    const markdown = [
      "# Agent Canvas Demo",
      "",
      "This report was generated by the agent.",
      "",
      "## Highlights",
      "",
      "- First point",
      "- Second point",
      "- Third point",
    ].join("\n");

    renderVisualizer(
      <Body
        observation={fileEditorObservation({
          command: "create",
          path: "canvas.md",
          new_content: markdown,
        })}
      />,
    );

    expect(screen.getByTestId("markdown-file-preview")).toBeInTheDocument();
    expect(screen.getByTestId("markdown-file-preview-content")).toHaveClass(
      "max-h-40",
      "overflow-y-auto",
      "custom-scrollbar-always",
    );
    expect(screen.getByText("Agent Canvas Demo")).toBeInTheDocument();
    expect(screen.getByText("canvas.md")).toBeInTheDocument();

    await user.click(screen.getByTestId("markdown-file-preview-view"));

    expect(useFilesTabStore.getState()).toMatchObject({
      selectedPath: "canvas.md",
      selectedConversationId: "test-conversation-id",
    });
    expect(useConversationStore.getState()).toMatchObject({
      hasRightPanelToggled: true,
      selectedTab: "files",
    });
  });

  it("keeps non-markdown creates as a full code block", () => {
    const { container } = renderVisualizer(
      <Body
        observation={fileEditorObservation({
          command: "create",
          path: "/workspace/app.ts",
          new_content: "const x = 1;",
        })}
      />,
    );

    expect(
      screen.queryByTestId("markdown-file-preview"),
    ).not.toBeInTheDocument();
    expect(container).toHaveTextContent("const x = 1;");
  });

  it("shows an in-flight markdown create preview without a View affordance", () => {
    renderVisualizer(
      <Body
        action={fileEditorAction({
          command: "create",
          path: "/workspace/notes.md",
          file_text: "# Draft",
        })}
      />,
    );

    expect(screen.getByTestId("markdown-file-preview")).toBeInTheDocument();
    expect(screen.getByText("Draft")).toBeInTheDocument();
    expect(
      screen.queryByTestId("markdown-file-preview-view"),
    ).not.toBeInTheDocument();
  });

  it("stores a workspace-relative path when View opens an absolute .md create", async () => {
    const user = userEvent.setup();

    renderVisualizer(
      <Body
        observation={fileEditorObservation({
          command: "create",
          path: "/workspace/docs/report.md",
          new_content: "# Report",
        })}
      />,
    );

    await user.click(screen.getByTestId("markdown-file-preview-view"));

    expect(useFilesTabStore.getState()).toMatchObject({
      selectedPath: "docs/report.md",
      selectedConversationId: "test-conversation-id",
    });
  });
});
