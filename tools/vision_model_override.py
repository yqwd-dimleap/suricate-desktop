"""Hardcode vision support for local openai/marmot (VL via vLLM)."""

from openhands.sdk.llm.llm import LLM

_original = LLM.vision_is_active


def vision_is_active(self) -> bool:
    if self.disable_vision:
        return False
    name = (self.model_canonical_name or self.model or "").lower()
    if "marmot" in name:
        return True
    return _original(self)


LLM.vision_is_active = vision_is_active  # type: ignore[method-assign]
