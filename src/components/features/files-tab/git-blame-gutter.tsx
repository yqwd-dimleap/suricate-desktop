import React from "react";
import type { editor as MonacoEditor } from "monaco-editor";
import type { BlameAnnotationBlock } from "#/utils/git-blame-annotations";
import { formatBlameAnnotationLabel } from "#/utils/git-blame-annotations";
import { cn } from "#/utils/utils";

/** Fixed width for the left-of-linenumbers annotate column (Cursor-like). */
export const GIT_BLAME_GUTTER_WIDTH_PX = 148;

type EditorLayoutSnapshot = {
  scrollTop: number;
  height: number;
  /** Bumped when line geometry may have changed (wrap, font, content). */
  geometryEpoch: number;
};

type GutterBlockLayout = {
  block: BlameAnnotationBlock;
  top: number;
  height: number;
  label: string;
  stripe: number;
};

function formatBlameTooltip(block: BlameAnnotationBlock): string {
  const when = (() => {
    const parsed = new Date(block.authorTime);
    if (Number.isNaN(parsed.getTime())) {
      return block.authorTime;
    }
    return parsed.toLocaleString();
  })();
  const lines = [
    block.sha,
    block.author,
    when,
    block.summary.trim().length > 0 ? block.summary.trim() : null,
  ].filter(Boolean);
  return lines.join("\n");
}

interface GitBlameGutterProps {
  editorRef: React.RefObject<MonacoEditor.IStandaloneCodeEditor | null>;
  blocks: BlameAnnotationBlock[];
  labels: { today: string; yesterday: string };
}

/**
 * Cursor/JetBrains-style annotate column rendered to the LEFT of Monaco's
 * line-number gutter. Scroll and line geometry stay synced with the editor;
 * unmounting this component fully restores the prior layout.
 */
export function GitBlameGutter({
  editorRef,
  blocks,
  labels,
}: GitBlameGutterProps) {
  const [layout, setLayout] = React.useState<EditorLayoutSnapshot>({
    scrollTop: 0,
    height: 0,
    geometryEpoch: 0,
  });
  const [hoveredSha, setHoveredSha] = React.useState<string | null>(null);

  React.useEffect(() => {
    const editor = editorRef.current;
    if (!editor) {
      return undefined;
    }

    let epoch = 0;
    const sync = () => {
      epoch += 1;
      setLayout({
        scrollTop: editor.getScrollTop(),
        height: editor.getLayoutInfo().height,
        geometryEpoch: epoch,
      });
    };

    sync();
    const disposables = [
      editor.onDidScrollChange(sync),
      editor.onDidLayoutChange(sync),
      editor.onDidContentSizeChange(sync),
      editor.onDidChangeConfiguration(sync),
    ];
    return () => {
      for (const disposable of disposables) {
        disposable.dispose();
      }
    };
  }, [editorRef, blocks]);

  const renderedBlocks = React.useMemo((): GutterBlockLayout[] => {
    const editor = editorRef.current;
    if (!editor || blocks.length === 0) {
      return [];
    }
    // geometryEpoch is a dependency so tops recompute after wrap/font changes.
    void layout.geometryEpoch;

    return blocks.map((block, index) => {
      const top =
        editor.getTopForLineNumber(block.startLine) - layout.scrollTop;
      const bottom =
        editor.getBottomForLineNumber(block.endLine) - layout.scrollTop;
      return {
        block,
        top,
        height: Math.max(0, bottom - top),
        label: formatBlameAnnotationLabel(block, labels),
        stripe: index % 2,
      };
    });
  }, [blocks, editorRef, labels, layout.geometryEpoch, layout.scrollTop]);

  return (
    <div
      className="relative shrink-0 overflow-hidden border-r border-[var(--oh-border)] bg-[var(--oh-background)]"
      style={{
        width: GIT_BLAME_GUTTER_WIDTH_PX,
        height: layout.height > 0 ? layout.height : "100%",
      }}
      data-testid="git-blame-gutter"
      aria-hidden
    >
      {renderedBlocks.map(({ block, top, height, label, stripe }) => {
        const isHovered = hoveredSha === block.sha;
        return (
          <div
            key={`${block.sha}-${block.startLine}`}
            data-testid="git-blame-gutter-block"
            data-sha={block.sha}
            title={formatBlameTooltip(block)}
            className={cn(
              "absolute left-0 right-0 box-border cursor-default overflow-hidden px-1.5",
              stripe === 0
                ? "git-blame-gutter-stripe-a"
                : "git-blame-gutter-stripe-b",
              isHovered && "git-blame-gutter-block-hover",
            )}
            style={{ top, height }}
            onMouseEnter={() => setHoveredSha(block.sha)}
            onMouseLeave={() =>
              setHoveredSha((current) =>
                current === block.sha ? null : current,
              )
            }
          >
            <span
              className="git-blame-gutter-label block truncate leading-[inherit]"
              style={{ lineHeight: `${Math.min(height, 22)}px` }}
            >
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
