/**
 * Map a shell command to a short intent label (i18n key) for chat titles.
 * The expandable body still shows the raw command; the title stays high-level.
 */

export type BashTitleIntent = {
  /** Present-tense key while the action is in flight. */
  actionKey: string;
  /** Past-tense key once the observation lands. */
  observationKey: string;
  values?: Readonly<Record<string, string>>;
};

const GENERIC: BashTitleIntent = {
  actionKey: "ACTION_MESSAGE$BASH_COMMAND",
  observationKey: "OBSERVATION_MESSAGE$BASH_COMMAND",
};

function basenameFromPath(path: string): string | null {
  const cleaned = path.replace(/['"]/g, "").replace(/\/+$/, "");
  if (!cleaned || cleaned.startsWith("-")) return null;
  const parts = cleaned.split("/");
  const name = parts[parts.length - 1];
  return name && name !== "." && name !== ".." ? name : null;
}

/** First path-like token after a known file-reading command. */
function extractReadTarget(command: string): string | null {
  const beforePipe = command.split("|")[0] ?? command;

  // Prefer a path with a file extension (trainer.py, README.md, …).
  const withExt = beforePipe.match(
    /(?:^|[\s'"])((?:\.\/|\/)?(?:[\w.~-]+\/)*[\w.~-]+\.[A-Za-z0-9]+)(?=[\s'"]|$)/,
  );
  if (withExt?.[1]) {
    return basenameFromPath(withExt[1]);
  }

  const readerMatch = beforePipe.match(
    /\b(?:cat|head|tail|less|more|bat|nl)\b(?:\s+-[^\s]+)*\s+((?:\.\/|\/|[\w.~-])[\w./~-]*)/,
  );
  if (readerMatch?.[1]) {
    return basenameFromPath(readerMatch[1]);
  }

  return null;
}

function has(command: string, pattern: RegExp): boolean {
  return pattern.test(command);
}

/**
 * Classify a bash/terminal command into a user-facing intent for the title row.
 */
export function summarizeBashCommand(
  command: string | null | undefined,
): BashTitleIntent {
  const raw = (command ?? "").trim();
  if (!raw) return GENERIC;

  const cmd = raw.replace(/\s+/g, " ");

  // Linters / typecheckers
  if (
    has(cmd, /\b(?:ruff|eslint|pylint|flake8|mypy|pyright|tsc|prettier)\b/) ||
    has(cmd, /\b(?:npm|pnpm|yarn|bun)\s+run\s+lint\b/)
  ) {
    return {
      actionKey: "ACTION_MESSAGE$BASH_LINT",
      observationKey: "OBSERVATION_MESSAGE$BASH_LINT",
    };
  }

  // Tests
  if (
    has(
      cmd,
      /\b(?:pytest|py\.test|vitest|jest|mocha|phpunit|go\s+test|cargo\s+test|npm\s+test|pnpm\s+test|yarn\s+test|bun\s+test)\b/,
    ) ||
    has(cmd, /\b(?:npm|pnpm|yarn|bun)\s+run\s+test\b/)
  ) {
    return {
      actionKey: "ACTION_MESSAGE$BASH_TEST",
      observationKey: "OBSERVATION_MESSAGE$BASH_TEST",
    };
  }

  // Install / deps
  if (
    has(
      cmd,
      /\b(?:npm|pnpm|yarn|bun)\s+(?:i|install|ci|add)\b|\bpip(?:3)?\s+install\b|\buv\s+(?:pip\s+)?install\b|\buv\s+sync\b|\bpoetry\s+install\b|\bcargo\s+add\b/,
    )
  ) {
    return {
      actionKey: "ACTION_MESSAGE$BASH_INSTALL",
      observationKey: "OBSERVATION_MESSAGE$BASH_INSTALL",
    };
  }

  // Build
  if (
    has(
      cmd,
      /\b(?:npm|pnpm|yarn|bun)\s+run\s+build\b|\bmake\b|\bcargo\s+build\b|\bmw?\s+compile\b|\bgradlew?\b.*\bbuild\b/,
    )
  ) {
    return {
      actionKey: "ACTION_MESSAGE$BASH_BUILD",
      observationKey: "OBSERVATION_MESSAGE$BASH_BUILD",
    };
  }

  // Git
  if (has(cmd, /\bgit\s+status\b/)) {
    return {
      actionKey: "ACTION_MESSAGE$BASH_GIT_STATUS",
      observationKey: "OBSERVATION_MESSAGE$BASH_GIT_STATUS",
    };
  }
  if (has(cmd, /\bgit\s+diff\b/)) {
    return {
      actionKey: "ACTION_MESSAGE$BASH_GIT_DIFF",
      observationKey: "OBSERVATION_MESSAGE$BASH_GIT_DIFF",
    };
  }
  if (has(cmd, /\bgit\s+(?:log|show|blame)\b/)) {
    return {
      actionKey: "ACTION_MESSAGE$BASH_GIT_LOG",
      observationKey: "OBSERVATION_MESSAGE$BASH_GIT_LOG",
    };
  }
  if (has(cmd, /\bgit\b/)) {
    return {
      actionKey: "ACTION_MESSAGE$BASH_GIT",
      observationKey: "OBSERVATION_MESSAGE$BASH_GIT",
    };
  }

  // Search — but sed|grep peeks of a single file count as reading.
  if (has(cmd, /\b(?:rg|grep|ag|ack|find)\b/) || has(cmd, /\bsed\b/)) {
    if (
      has(cmd, /\bsed\b/) ||
      has(cmd, /^\s*(?:\w+=\w+\s+)*(?:cat|head|tail)\b/)
    ) {
      const file = extractReadTarget(cmd);
      if (file) {
        return {
          actionKey: "ACTION_MESSAGE$BASH_READ_FILE",
          observationKey: "OBSERVATION_MESSAGE$BASH_READ_FILE",
          values: { file },
        };
      }
      if (has(cmd, /\bsed\b/) && !has(cmd, /\b(?:rg|grep|ag|ack|find)\b/)) {
        return {
          actionKey: "ACTION_MESSAGE$BASH_READ",
          observationKey: "OBSERVATION_MESSAGE$BASH_READ",
        };
      }
    }
    if (has(cmd, /\b(?:rg|grep|ag|ack|find)\b/)) {
      return {
        actionKey: "ACTION_MESSAGE$BASH_SEARCH",
        observationKey: "OBSERVATION_MESSAGE$BASH_SEARCH",
      };
    }
  }

  // Read file contents
  if (has(cmd, /\b(?:cat|head|tail|less|more|bat|nl)\b/)) {
    const file = extractReadTarget(cmd);
    if (file) {
      return {
        actionKey: "ACTION_MESSAGE$BASH_READ_FILE",
        observationKey: "OBSERVATION_MESSAGE$BASH_READ_FILE",
        values: { file },
      };
    }
    return {
      actionKey: "ACTION_MESSAGE$BASH_READ",
      observationKey: "OBSERVATION_MESSAGE$BASH_READ",
    };
  }

  // Python one-liners / scripts (not covered above)
  if (has(cmd, /\b(?:python3?|ipython)\b/)) {
    return {
      actionKey: "ACTION_MESSAGE$BASH_PYTHON",
      observationKey: "OBSERVATION_MESSAGE$BASH_PYTHON",
    };
  }

  return GENERIC;
}
