import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DiffView } from "#/components/features/chat/tool-visualizers/primitives/diff-view";

describe("DiffView coloring", () => {
  it("keeps add/del row backgrounds without forcing solid text color", () => {
    render(
      <DiffView
        oldText={'const a = "old";\n'}
        newText={'const a = "new";\n'}
        language="javascript"
      />,
    );

    const addRow = screen
      .getByTestId("diff-view")
      .querySelector('[data-diff-type="add"]');
    const delRow = screen
      .getByTestId("diff-view")
      .querySelector('[data-diff-type="del"]');

    expect(addRow?.className).toContain("bg-[var(--oh-status-success)]/20");
    expect(delRow?.className).toContain("bg-[var(--oh-status-error)]/20");
    // Syntax highlight spans should be present (not plain forced red/green text).
    expect(addRow?.querySelector("span.token, code span")).toBeTruthy();
  });
});
