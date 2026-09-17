import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { editor as MonacoEditor } from "monaco-editor";
import { GitBlameGutter } from "#/components/features/files-tab/git-blame-gutter";
import type { BlameAnnotationBlock } from "#/utils/git-blame-annotations";

/* eslint-disable i18next/no-literal-string -- test fixture labels */

function makeEditor(): MonacoEditor.IStandaloneCodeEditor {
  const lineHeight = 20;
  return {
    getScrollTop: () => 0,
    getLayoutInfo: () => ({ height: 400 }) as MonacoEditor.EditorLayoutInfo,
    getTopForLineNumber: (line: number) => (line - 1) * lineHeight,
    getBottomForLineNumber: (line: number) => line * lineHeight,
    onDidScrollChange: () => ({ dispose: vi.fn() }),
    onDidLayoutChange: () => ({ dispose: vi.fn() }),
    onDidContentSizeChange: () => ({ dispose: vi.fn() }),
    onDidChangeConfiguration: () => ({ dispose: vi.fn() }),
  } as unknown as MonacoEditor.IStandaloneCodeEditor;
}

const BLOCKS: BlameAnnotationBlock[] = [
  {
    startLine: 1,
    endLine: 2,
    sha: "aaa1111",
    author: "alice",
    authorTime: "2026-09-17T10:00:00+08:00",
    summary: "first",
    relativeKind: "today",
    dateLabel: "",
  },
  {
    startLine: 3,
    endLine: 3,
    sha: "bbb2222",
    author: "bob",
    authorTime: "2026-09-16T10:00:00+08:00",
    summary: "second",
    relativeKind: "yesterday",
    dateLabel: "",
  },
];

describe("GitBlameGutter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders a left annotate column with one block per commit run", () => {
    const editorRef = {
      current: makeEditor(),
    };

    render(
      <GitBlameGutter
        editorRef={editorRef}
        blocks={BLOCKS}
        labels={{ today: "Today", yesterday: "Yesterday" }}
      />,
    );

    expect(screen.getByTestId("git-blame-gutter")).toBeInTheDocument();
    const blocks = screen.getAllByTestId("git-blame-gutter-block");
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toHaveTextContent(/Today\s+alice/);
    expect(blocks[1]).toHaveTextContent(/Yesterday\s+bob/);
  });
});
