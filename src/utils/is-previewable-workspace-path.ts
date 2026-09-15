/** Extensions that open in the Preview tab (rich render) rather than Files. */
const PREVIEWABLE_EXTS = new Set([
  "html",
  "htm",
  "svg",
  "md",
  "markdown",
  "mdx",
  "pdf",
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "bmp",
  "ico",
]);

function getExtension(path: string): string {
  const base = path.split(/[/\\]/).pop() ?? path;
  const idx = base.lastIndexOf(".");
  return idx === -1 ? "" : base.slice(idx + 1).toLowerCase();
}

/**
 * True when the path should open in the Preview drawer tab (HTML / Markdown /
 * images / PDF). Source files and anything with an explicit line reveal still
 * go to Files.
 */
export function isPreviewableWorkspacePath(path: string): boolean {
  return PREVIEWABLE_EXTS.has(getExtension(path));
}
