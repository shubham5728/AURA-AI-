"""Model access for the agent layer.

Mirrors the parser's structure: one interface, a real implementation, and a mock
used when no key is configured. The mock is not only a development convenience
-- it is the demo fallback if the API is unreachable on stage.
"""

import logging
from abc import ABC, abstractmethod
from typing import List, Optional

logger = logging.getLogger(__name__)


class LLMError(Exception):
    """Generation failed in a way the caller should surface."""


class LLMClient(ABC):
    @abstractmethod
    def generate_text(self, prompt: str) -> str:
        """Single-turn completion. Used for routing."""

    @abstractmethod
    def chat(self, system: str, history: List[dict], message: str) -> str:
        """Multi-turn reply. `history` is [{role: user|assistant, content: str}]."""


class GeminiClient(LLMClient):
    def __init__(self, api_key: str, model: str, fallback_model: str = ""):
        from google import genai

        self._client = genai.Client(api_key=api_key)
        self._model = model
        self._fallback_model = fallback_model

    def _generate(self, contents, system: Optional[str] = None) -> str:
        from google.genai import types

        config = (
            types.GenerateContentConfig(system_instruction=system) if system else None
        )

        try:
            response = self._client.models.generate_content(
                model=self._model, contents=contents, config=config
            )
        except Exception as exc:
            # Free-tier quota is counted per model, so an exhausted primary does
            # not mean an exhausted key. A shorter answer from a lighter model
            # beats an error page mid-conversation.
            from app.services.parser import is_quota_error

            if not (self._fallback_model and is_quota_error(exc)):
                logger.warning("Generation failed: %s", exc)
                raise LLMError(str(exc)) from exc

            logger.warning("Primary model out of quota; retrying on %s", self._fallback_model)
            try:
                response = self._client.models.generate_content(
                    model=self._fallback_model, contents=contents, config=config
                )
            except Exception as fallback_exc:
                logger.warning("Fallback model also failed: %s", fallback_exc)
                raise LLMError(str(fallback_exc)) from fallback_exc

        text = (response.text or "").strip()
        if not text:
            # An empty completion is usually a safety block on the provider's
            # side. Surfacing it as an error beats returning a blank reply.
            raise LLMError("Model returned an empty response.")
        return text

    def generate_text(self, prompt: str) -> str:
        return self._generate(prompt)

    def chat(self, system: str, history: List[dict], message: str) -> str:
        from google.genai import types

        contents = [
            types.Content(
                role="model" if turn["role"] == "assistant" else "user",
                parts=[types.Part.from_text(text=turn["content"])],
            )
            for turn in history
        ]
        contents.append(
            types.Content(role="user", parts=[types.Part.from_text(text=message)])
        )
        return self._generate(contents, system=system)


class MockLLMClient(LLMClient):
    """Deterministic canned replies for offline development and tests."""

    def generate_text(self, prompt: str) -> str:
        return "doctor"

    def chat(self, system: str, history: List[dict], message: str) -> str:
        return (
            "I am running without a language model connected, so this is a placeholder "
            "reply. Your data was loaded correctly and the routing worked -- set "
            "GEMINI_API_KEY to get real answers."
        )


def get_llm() -> LLMClient:
    from app.config import get_settings

    settings = get_settings()
    if settings.gemini_api_key:
        return GeminiClient(
            settings.gemini_api_key,
            settings.gemini_model,
            settings.gemini_fallback_model,
        )

    logger.warning("GEMINI_API_KEY not set -- using MockLLMClient.")
    return MockLLMClient()
