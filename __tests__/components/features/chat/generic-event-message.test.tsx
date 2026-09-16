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
});
