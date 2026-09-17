import { describe, expect, it } from "vitest";
import { summarizeBashCommand } from "#/utils/summarize-bash-command";

describe("summarizeBashCommand", () => {
  it.each([
    [
      "sed -n '1,125p' src/llamafactory/train/sft/trainer.py | grep -n '^import'",
      "ACTION_MESSAGE$BASH_READ_FILE",
      { file: "trainer.py" },
    ],
    [
      "ruff check src/llamafactory/train/",
      "ACTION_MESSAGE$BASH_LINT",
      undefined,
    ],
    ["pytest -q tests/", "ACTION_MESSAGE$BASH_TEST", undefined],
    ["git status", "ACTION_MESSAGE$BASH_GIT_STATUS", undefined],
    ["git log --oneline -20", "ACTION_MESSAGE$BASH_GIT_LOG", undefined],
    ["rg -n 'pattern' src/", "ACTION_MESSAGE$BASH_SEARCH", undefined],
    ["npm install", "ACTION_MESSAGE$BASH_INSTALL", undefined],
    ["npm run build", "ACTION_MESSAGE$BASH_BUILD", undefined],
    ["python -c 'print(1)'", "ACTION_MESSAGE$BASH_PYTHON", undefined],
    ["echo hello", "ACTION_MESSAGE$BASH_COMMAND", undefined],
  ] as const)("classifies %s", (command, actionKey, values) => {
    const intent = summarizeBashCommand(command);
    expect(intent.actionKey).toBe(actionKey);
    if (values) {
      expect(intent.values).toEqual(values);
    }
  });

  it("pairs past-tense observation keys with each intent", () => {
    expect(summarizeBashCommand("ruff check .").observationKey).toBe(
      "OBSERVATION_MESSAGE$BASH_LINT",
    );
  });
});
