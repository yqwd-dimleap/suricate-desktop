import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { SecurityRisk } from "#/types/agent-server/core";
import { bashVisualizer } from "#/components/features/chat/tool-visualizers/bash/bash";
import {
  renderVisualizer,
  bashAction,
  bashObservation,
  terminalObservation,
} from "../test-utils";

const Body = bashVisualizer.Body;

describe("bashVisualizer", () => {
  it("renders the command in the action card", () => {
    renderVisualizer(<Body action={bashAction("echo hello")} />);
    expect(screen.getByTestId("bash-visualizer-command")).toHaveTextContent(
      "echo hello",
    );
    expect(screen.queryByTestId("bash-visualizer-output")).not.toBeInTheDocument();
  });

  it("warns about high-risk actions", () => {
    renderVisualizer(
      <Body action={bashAction("rm -rf /", SecurityRisk.HIGH)} />,
    );
    expect(screen.getByText("SECURITY$HIGH_RISK")).toBeInTheDocument();
  });

  it("puts command and output in a single terminal pane", () => {
    renderVisualizer(
      <Body
        observation={bashObservation("hello world", 0, "echo hello world")}
      />,
    );
    const terminal = screen.getByTestId("bash-visualizer-terminal");
    expect(terminal).toHaveTextContent("echo hello world");
    expect(terminal).toHaveTextContent("hello world");
    expect(screen.getByTestId("bash-visualizer-command")).toHaveTextContent(
      "echo hello world",
    );
    expect(screen.getByTestId("bash-visualizer-output")).toHaveTextContent(
      "hello world",
    );
    // One pane only — no separate command CodeBlock + OutputPane pair.
    expect(screen.getAllByTestId("bash-visualizer-terminal")).toHaveLength(1);
    expect(screen.queryByText("OBSERVATION$EXIT_CODE")).not.toBeInTheDocument();
  });

  it("styles command brighter than successful output", () => {
    renderVisualizer(
      <Body
        observation={bashObservation("hello world", 0, "echo hello world")}
      />,
    );
    expect(screen.getByTestId("bash-visualizer-command").className).toContain(
      "oh-foreground",
    );
    expect(screen.getByTestId("bash-visualizer-output").className).toContain(
      "oh-muted",
    );
  });

  it("badges a non-zero exit code (error state)", () => {
    renderVisualizer(<Body observation={bashObservation("boom", 1)} />);
    expect(screen.getByText("OBSERVATION$EXIT_CODE")).toBeInTheDocument();
    expect(screen.getByTestId("bash-visualizer-output")).toHaveTextContent(
      "boom",
    );
  });

  it("shows a placeholder when there is no output", () => {
    renderVisualizer(<Body observation={bashObservation("", 0)} />);
    expect(screen.getByTestId("bash-visualizer-output")).toHaveTextContent(
      "OBSERVATION$COMMAND_NO_OUTPUT",
    );
  });

  it("exposes a single copy button for the combined terminal text", () => {
    renderVisualizer(
      <Body
        observation={bashObservation("hello world", 0, "echo hello world")}
      />,
    );
    expect(screen.getAllByTestId("copy-to-clipboard")).toHaveLength(1);
  });

  it("still offers copy when there is only a command (empty output)", () => {
    renderVisualizer(<Body observation={bashObservation("", 0, "true")} />);
    expect(screen.getAllByTestId("copy-to-clipboard")).toHaveLength(1);
  });

  it("renders long command output inside the same scrollable pane", () => {
    const longOutput = `${"a".repeat(500)}tail-marker`;
    renderVisualizer(<Body observation={bashObservation(longOutput, 0)} />);

    expect(screen.getByTestId("bash-visualizer-terminal")).toHaveTextContent(
      "tail-marker",
    );
    expect(screen.getByTestId("bash-visualizer-terminal").className).toContain(
      "max-h-64",
    );
  });

  it("renders command and output for the terminal tool", () => {
    renderVisualizer(
      <Body observation={terminalObservation("362 index.html", 0, "wc -l")} />,
    );
    expect(screen.getByTestId("bash-visualizer-command")).toHaveTextContent(
      "wc -l",
    );
    expect(screen.getByTestId("bash-visualizer-output")).toHaveTextContent(
      "362 index.html",
    );
  });

  it("strips a soft-wrapped command echo from the log pane", () => {
    const command =
      'uname -a && echo "---" && python3 --version && nvidia-smi | head';
    // Soft-wrap inserts spaces mid-token (matches real terminal capture).
    const echoed =
      'uname -a && echo "---" && python3 -- version && nvidia- smi | head\nDarwin arm64\nPython 3.14.0';
    renderVisualizer(
      <Body observation={bashObservation(echoed, 0, command)} />,
    );
    const output = screen.getByTestId("bash-visualizer-output");
    expect(output).toHaveTextContent("Darwin arm64");
    expect(output).toHaveTextContent("Python 3.14.0");
    expect(output).not.toHaveTextContent("nvidia- smi");
  });

  it("styles interrupt/error observation text as an error", () => {
    renderVisualizer(
      <Body
        observation={terminalObservation(
          "Tool call interrupted before completion. The conversation was paused.",
          1,
          "du -sh .",
        )}
      />,
    );
    const output = screen.getByTestId("bash-visualizer-output");
    expect(output).toHaveTextContent("Tool call interrupted");
    expect(output.className).toContain("oh-status-error");
  });
});
