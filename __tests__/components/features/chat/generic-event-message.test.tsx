import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "test-utils";
import { GenericEventMessage } from "#/components/features/chat/generic-event-message";

describe("GenericEventMessage", () => {
  it("toggles details when the title text is clicked", async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <GenericEventMessage
        title="Read inject-bridge.js"
        details="file contents here"
      />,
    );

    expect(screen.queryByText("file contents here")).not.toBeInTheDocument();

    await user.click(screen.getByText("Read inject-bridge.js"));
    expect(screen.getByText("file contents here")).toBeInTheDocument();

    await user.click(screen.getByText("Read inject-bridge.js"));
    expect(screen.queryByText("file contents here")).not.toBeInTheDocument();
  });

  it("toggles details from the trailing chevron without requiring the title", async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <GenericEventMessage title="Ran ls" details="output lines" />,
    );

    expect(screen.queryByText("output lines")).not.toBeInTheDocument();
    expect(
      screen.getByTestId("generic-event-message-expand"),
    ).toHaveAttribute("aria-expanded", "false");

    await user.click(screen.getByTestId("generic-event-message-expand"));

    expect(screen.getByText("output lines")).toBeInTheDocument();
    expect(
      screen.getByTestId("generic-event-message-expand"),
    ).toHaveAttribute("aria-expanded", "true");
  });
});
