import { describe, expect, it } from "vitest";
import {
  appendSystemMessageSuffixToStartPayload,
  UNATTACHED_WORKSPACE_SYSTEM_SUFFIX,
} from "#/utils/unattached-workspace-suffix";

describe("unattached-workspace-suffix", () => {
  it("appends WORKSPACE_STATUS onto agent_settings.agent_context", () => {
    const payload = appendSystemMessageSuffixToStartPayload(
      {
        agent_settings: {
          llm: { model: "gpt-4o" },
          agent_context: { system_message_suffix: "<RUNTIME_SERVICES>\nok" },
        },
      },
      UNATTACHED_WORKSPACE_SYSTEM_SUFFIX,
    );

    const settings = payload.agent_settings as {
      agent_context: { system_message_suffix: string };
    };
    expect(settings.agent_context.system_message_suffix).toContain(
      "<RUNTIME_SERVICES>\nok",
    );
    expect(settings.agent_context.system_message_suffix).toContain(
      "<WORKSPACE_STATUS>",
    );
    expect(settings.agent_context.system_message_suffix).toContain(
      "Do NOT run `git log`",
    );
  });

  it("is a no-op when the payload uses agent_profile_id without agent_settings", () => {
    const original = { agent_profile_id: "profile-1" };
    expect(
      appendSystemMessageSuffixToStartPayload(
        original,
        UNATTACHED_WORKSPACE_SYSTEM_SUFFIX,
      ),
    ).toEqual(original);
  });
});
