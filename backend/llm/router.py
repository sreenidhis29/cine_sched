"""
LLM Router for CineSched.

Routing logic:
  1. Try Groq (llama-3.3-70b-versatile) as PRIMARY.
  2. On ANY Groq error (timeout, rate-limit, API error), fall back to Gemini.
  3. For structured calls: enforce JSON schema in system prompt, validate via
     Pydantic, and retry up to MAX_REPAIR_RETRIES times with the parse error
     fed back to the model.
  4. If all retries fail, raise LLMRouterError (never a silent crash).
"""
from __future__ import annotations

import json
import logging
from typing import Any, Dict, List, Optional, Type, TypeVar

from pydantic import BaseModel, ValidationError

from llm import groq_client, gemini_client

logger = logging.getLogger(__name__)

MAX_REPAIR_RETRIES = 2


class LLMRouterError(Exception):
    """Raised when all LLM providers and retries are exhausted."""
    pass


T = TypeVar("T", bound=BaseModel)


# ─────────────────────────────────────────────────────────────────────────────
# PUBLIC API
# ─────────────────────────────────────────────────────────────────────────────
def chat(
    messages: List[Dict[str, str]],
    system_prompt: str = "",
    temperature: float = 0.3,
    max_tokens: int = 4096,
) -> str:
    """
    Route a free-form chat call through Groq → Gemini fallback.
    Returns the assistant's text response.
    Raises LLMRouterError if both providers fail.
    """
    try:
        result = groq_client.chat(messages, system_prompt, temperature, max_tokens)
        logger.debug("LLM router: used Groq (primary)")
        return result
    except Exception as groq_err:
        logger.warning("Groq failed (%s), falling back to Gemini", groq_err)

    try:
        result = gemini_client.chat(messages, system_prompt, temperature, max_tokens)
        logger.debug("LLM router: used Gemini (fallback)")
        return result
    except Exception as gemini_err:
        raise LLMRouterError(
            f"Both LLM providers failed. Groq: {groq_err!r}. Gemini: {gemini_err!r}"
        ) from gemini_err


def structured_call(
    messages: List[Dict[str, str]],
    system_prompt: str,
    schema: Type[T],
    temperature: float = 0.1,
    max_tokens: int = 4096,
) -> T:
    """
    Route a structured output call. The system_prompt MUST describe the exact
    JSON schema expected. Returns a validated Pydantic model instance.

    Implements a repair-retry loop:
      - Parse the JSON response.
      - Validate against `schema`.
      - On failure, feed the error message back as a new user message and retry.
      - After MAX_REPAIR_RETRIES failures, raise LLMRouterError.
    """
    schema_json = json.dumps(schema.model_json_schema(), indent=2)
    full_system = (
        f"{system_prompt}\n\n"
        f"You MUST respond with a single valid JSON object that conforms exactly "
        f"to this JSON Schema:\n```json\n{schema_json}\n```\n"
        f"Do not include any explanation, markdown, or text outside the JSON object."
    )

    current_messages = list(messages)
    last_error: Optional[Exception] = None

    for attempt in range(MAX_REPAIR_RETRIES + 1):
        raw = _raw_structured(current_messages, full_system, temperature, max_tokens)

        try:
            data = _extract_json(raw)
            return schema.model_validate(data)
        except (json.JSONDecodeError, ValidationError, ValueError) as parse_err:
            last_error = parse_err
            if attempt < MAX_REPAIR_RETRIES:
                repair_msg = (
                    f"Your previous response could not be parsed.\n"
                    f"Error: {parse_err}\n"
                    f"Previous response:\n{raw}\n\n"
                    f"Please respond again with ONLY valid JSON matching the schema."
                )
                current_messages = list(messages) + [
                    {"role": "assistant", "content": raw},
                    {"role": "user", "content": repair_msg},
                ]
                logger.warning(
                    "LLM structured call repair attempt %d/%d: %s",
                    attempt + 1, MAX_REPAIR_RETRIES, parse_err
                )

    raise LLMRouterError(
        f"Structured call failed after {MAX_REPAIR_RETRIES} repair retries. "
        f"Last error: {last_error}"
    )


# ─────────────────────────────────────────────────────────────────────────────
# INTERNAL HELPERS
# ─────────────────────────────────────────────────────────────────────────────
def _raw_structured(
    messages: List[Dict[str, str]],
    system_prompt: str,
    temperature: float,
    max_tokens: int,
) -> str:
    """Try Groq structured, then Gemini structured."""
    try:
        result = groq_client.structured_chat(messages, system_prompt, temperature, max_tokens)
        logger.debug("LLM router structured: used Groq (primary)")
        return result
    except Exception as groq_err:
        logger.warning("Groq structured failed (%s), falling back to Gemini", groq_err)

    try:
        result = gemini_client.structured_chat(messages, system_prompt, temperature, max_tokens)
        logger.debug("LLM router structured: used Gemini (fallback)")
        return result
    except Exception as gemini_err:
        raise LLMRouterError(
            f"Both LLM providers failed for structured call. "
            f"Groq: {groq_err!r}. Gemini: {gemini_err!r}"
        ) from gemini_err


def _extract_json(text: str) -> Any:
    """
    Extract a JSON object from model output that might include markdown code fences.
    """
    text = text.strip()
    # Strip markdown code fences if present
    if text.startswith("```"):
        lines = text.split("\n")
        # Remove first line (```json or ```) and last line (```)
        inner = lines[1:-1] if lines[-1].strip() == "```" else lines[1:]
        text = "\n".join(inner).strip()
    return json.loads(text)
