import React from "react";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";

import { SyntaxHighlighter } from "#/components/features/markdown/syntax-highlighter";
import { getPrismLanguageForFile } from "#/utils/file-language";
import type { PendingFileReveal } from "#/stores/files-tab-store";

/** High-contrast flash so the range is obvious on dark syntax themes. */
const REVEAL_HIGHLIGHT_STYLE: React.CSSProperties = {
  display: "block",
  backgroundColor: "rgba(250, 204, 21, 0.28)",
  boxShadow: "inset 3px 0 0 rgb(250, 204, 21)",
  borderRadius: "2px",
};

interface HighlightedSourceViewProps {
  path: string;
  text: string;
  mimeType?: string;
  /**
   * Sticky line highlight for this path. Stays until Keep / Revert / the file
   * is clean vs HEAD. `nonce` bumps re-trigger scroll without clearing.
   */
  reveal?: PendingFileReveal | null;
}

function lineInReveal(
  lineNumber: number,
  reveal: PendingFileReveal | null | undefined,
): boolean {
  if (!reveal) return false;
  return lineNumber >= reveal.startLine && lineNumber <= reveal.endLine;
}

/**
 * Renders the raw bytes of a workspace text file with Prism syntax
 * highlighting. Used both in:
 *   - Rich mode for actual source files (.ts, .py, .yaml, …) — there is
 *     no "rich" rendering of source code, so highlighted source IS the
 *     rich view.
 *   - Plain mode for source code AND for the source form of markdown /
 *     HTML files (so users can inspect the markup behind a rich preview).
 *
 * When we don't have a Prism grammar for the file we fall through to a
 * plain `<pre>` so the bytes still show. The wrapper styling matches the
 * right-pane background so the highlighted block reads as part of the
 * surrounding chrome instead of a floating card.
 */
export function HighlightedSourceView({
  path,
  text,
  mimeType,
  reveal,
}: HighlightedSourceViewProps) {
  const language = getPrismLanguageForFile(path, mimeType);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const activeReveal = reveal?.path === path ? reveal : null;

  React.useEffect(() => {
    if (!activeReveal) {
      return undefined;
    }

    const container = containerRef.current;
    if (!container) {
      return undefined;
    }

    // Wait a frame so SyntaxHighlighter has painted `data-reveal-line`.
    const frame = window.requestAnimationFrame(() => {
      const target = container.querySelector<HTMLElement>(
        `[data-reveal-line="${activeReveal.startLine}"]`,
      );
      target?.scrollIntoView({ block: "center", behavior: "smooth" });
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [
    activeReveal?.nonce,
    activeReveal?.startLine,
    activeReveal?.endLine,
    activeReveal,
  ]);

  if (!language) {
    const lines = text.split("\n");
    return (
      <div
        ref={containerRef}
        data-testid="file-content-viewer-plain"
        className="h-full w-full overflow-auto bg-[var(--oh-surface)] custom-scrollbar-always"
      >
        <pre className="m-0 whitespace-pre-wrap break-words p-4 text-xs leading-5 text-white">
          {lines.map((line, index) => {
            const lineNumber = index + 1;
            const highlighted = lineInReveal(lineNumber, activeReveal);
            return (
              <div
                // Plain fallback has no stable ids per line; index is fine.

                key={index}
                data-reveal-line={lineNumber}
                data-testid={
                  highlighted ? "file-reveal-line-active" : undefined
                }
                style={highlighted ? REVEAL_HIGHLIGHT_STYLE : undefined}
              >
                {line.length > 0 ? line : "\n"}
              </div>
            );
          })}
        </pre>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      data-testid="file-content-viewer-highlighted"
      data-language={language}
      className="h-full w-full overflow-auto bg-[var(--oh-surface)] custom-scrollbar-always"
    >
      <SyntaxHighlighter
        language={language}
        style={vscDarkPlus}
        showLineNumbers
        wrapLines
        wrapLongLines={false}
        // Override the theme's hard-coded background so the highlighter
        // blends with the right-pane chrome instead of painting a slab
        // of a slightly-different dark color.
        customStyle={{
          margin: 0,
          padding: "1rem",
          background: "transparent",
          fontSize: "0.75rem",
          lineHeight: "1.25rem",
          minHeight: "100%",
        }}
        codeTagProps={{
          style: { background: "transparent", fontFamily: "inherit" },
        }}
        lineNumberStyle={{
          color: "var(--oh-border)",
          minWidth: "2.5em",
          paddingRight: "1em",
          userSelect: "none",
        }}
        lineProps={(lineNumber) => {
          const highlighted = lineInReveal(lineNumber, activeReveal);
          return {
            "data-reveal-line": lineNumber,
            "data-testid": highlighted ? "file-reveal-line-active" : undefined,
            style: highlighted ? REVEAL_HIGHLIGHT_STYLE : { display: "block" },
          };
        }}
      >
        {text}
      </SyntaxHighlighter>
    </div>
  );
}
