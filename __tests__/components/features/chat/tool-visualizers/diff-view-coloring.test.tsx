import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import {
  COLLAPSED_VISIBLE_ROWS,
  DiffView,
} from "#/components/features/chat/tool-visualizers/primitives/diff-view";

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

  it("folds a long new-file diff behind an expand control", async () => {
    const user = userEvent.setup();
    const lines = Array.from(
      { length: COLLAPSED_VISIBLE_ROWS + 5 },
      (_, index) => `line-${index}`,
    );
    render(<DiffView oldText="" newText={lines.join("\n")} />);

    expect(screen.getByTestId("diff-view")).toHaveTextContent("line-0");
    expect(screen.getByTestId("diff-view")).not.toHaveTextContent(
      `line-${COLLAPSED_VISIBLE_ROWS + 4}`,
    );
    expect(screen.getByTestId("diff-view-expand")).toBeInTheDocument();

    await user.click(screen.getByTestId("diff-view-expand"));

    expect(screen.getByTestId("diff-view")).toHaveTextContent(
      `line-${COLLAPSED_VISIBLE_ROWS + 4}`,
    );
  });

  it("keeps the collapse control outside the scroll region after expand", async () => {
    const user = userEvent.setup();
    const lines = Array.from(
      { length: COLLAPSED_VISIBLE_ROWS + 5 },
      (_, index) => `line-${index}`,
    );
    render(<DiffView oldText="" newText={lines.join("\n")} />);

    await user.click(screen.getByTestId("diff-view-expand"));

    const scroll = screen.getByTestId("diff-view-scroll");
    const toggle = screen.getByTestId("diff-view-expand");
    expect(scroll.contains(toggle)).toBe(false);

    await user.click(toggle);
    expect(screen.getByTestId("diff-view")).not.toHaveTextContent(
      `line-${COLLAPSED_VISIBLE_ROWS + 4}`,
    );
  });

  it("lets the user expand skipped unchanged lines between hunks", async () => {
    const user = userEvent.setup();
    const unchanged = Array.from({ length: 20 }, (_, index) => `keep-${index}`);
    render(
      <DiffView
        oldText={["head", ...unchanged, "tail"].join("\n")}
        newText={["HEAD", ...unchanged, "TAIL"].join("\n")}
      />,
    );

    await user.click(screen.getByTestId("diff-view-expand"));

    expect(screen.getByTestId("diff-skip-row")).toBeInTheDocument();
    expect(screen.queryByText("keep-10")).not.toBeInTheDocument();

    await user.click(screen.getByTestId("diff-skip-row"));

    expect(screen.getByText("keep-10")).toBeInTheDocument();
  });

  it("prioritizes changed lines over leading context when collapsed", () => {
    const lead = Array.from({ length: 8 }, (_, index) => `before-${index}`);
    render(
      <DiffView
        oldText={[...lead, "OLD", "after"].join("\n")}
        newText={[...lead, "NEW", "after"].join("\n")}
      />,
    );

    const view = screen.getByTestId("diff-view");
    expect(view).toHaveTextContent("OLD");
    expect(view).toHaveTextContent("NEW");
    expect(view).not.toHaveTextContent("before-0");
  });
});
