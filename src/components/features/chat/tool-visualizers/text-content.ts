import {
  TextContent,
  ImageContent,
} from "#/types/agent-server/core/base/common";

/**
 * Joins the text parts of a tool observation's `content` array, dropping image
 * parts. Mirrors the extraction the markdown helpers do so migrated tools show
 * the same text the fallback path would have.
 */
export const textFromContent = (
  content: Array<TextContent | ImageContent>,
): string =>
  content
    .filter((c) => c.type === "text")
    .map((c) => c.text)
    .join("\n");

/**
 * Terminal capture sometimes echoes the command as a soft-wrapped first line
 * (spaces inserted mid-token). Drop that echo so the log pane shows stdout.
 */
export const stripSoftWrappedCommandEcho = (
  output: string,
  command: string,
): string => {
  if (!command || !output) {
    return output;
  }
  const newlineIndex = output.indexOf("\n");
  if (newlineIndex === -1) {
    return output;
  }
  const firstLine = output.slice(0, newlineIndex);
  const normalize = (value: string) => value.replace(/\s+/g, "");
  if (normalize(firstLine) !== normalize(command)) {
    return output;
  }
  return output.slice(newlineIndex + 1);
};
