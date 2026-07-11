"""
LLM Router for CineSched.

Routing logic:
  1. Try Groq (llama-3.3-70b-versatile) as PRIMARY.
  2. On ANY Groq error (timeout, rate-limit, API error), fall back to Gemini.
  3. For structured calls: enforce JSON schema in system prompt, validate via
     Pydantic, and retry up to MAX_REPAIR_RETRIES times with the parse error
     fed back to the model.
  4. If all retries fail, raise LLMRouterError (never a silent crash).
  5. Implements local file caching, backoff retries on rate limits, and request throttling.
"""
from __future__ import annotations

import json
import logging
import os
import hashlib
import time
import random
from typing import Any, Dict, List, Optional, Type, TypeVar

from pydantic import BaseModel, ValidationError

from llm import groq_client, gemini_client

logger = logging.getLogger(__name__)

MAX_REPAIR_RETRIES = 2
MIN_REQUEST_INTERVAL = 1.0  # Minimum 1.0 second between consecutive LLM calls
_last_request_time = 0.0

# Setup local caching directory
CACHE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data", "llm_cache"))
os.makedirs(CACHE_DIR, exist_ok=True)


class LLMRouterError(Exception):
    """Raised when all LLM providers and retries are exhausted."""
    pass


T = TypeVar("T", bound=BaseModel)


# ─────────────────────────────────────────────────────────────────────────────
# INTERNAL CACHE AND THROTTLING HELPERS
# ─────────────────────────────────────────────────────────────────────────────
def _calculate_key(
    messages: List[Dict[str, str]],
    system_prompt: str,
    temperature: float,
    max_tokens: int,
    schema_name: Optional[str] = None
) -> str:
    payload = {
        "messages": messages,
        "system_prompt": system_prompt,
        "temperature": temperature,
        "max_tokens": max_tokens,
        "schema_name": schema_name
    }
    serialized = json.dumps(payload, sort_keys=True)
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()


def _get_cache(key: str) -> Optional[str]:
    cache_file = os.path.join(CACHE_DIR, f"{key}.json")
    if os.path.exists(cache_file):
        try:
            with open(cache_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                return data.get("response")
        except Exception as e:
            logger.warning("Failed to read LLM cache: %s", e)
    return None


def _set_cache(key: str, content: str) -> None:
    cache_file = os.path.join(CACHE_DIR, f"{key}.json")
    try:
        with open(cache_file, "w", encoding="utf-8") as f:
            json.dump({"timestamp": time.time(), "response": content}, f, indent=2)
    except Exception as e:
        logger.warning("Failed to write LLM cache: %s", e)


def _throttle() -> None:
    global _last_request_time
    now = time.time()
    elapsed = now - _last_request_time
    if elapsed < MIN_REQUEST_INTERVAL:
        sleep_time = MIN_REQUEST_INTERVAL - elapsed
        logger.info("Throttling LLM request: sleeping for %.2f seconds...", sleep_time)
        time.sleep(sleep_time)
    _last_request_time = time.time()


def _call_with_backoff(func: Any, *args: Any, **kwargs: Any) -> Any:
    max_retries = 3
    base_delay = 2.0
    for attempt in range(max_retries):
        try:
            _throttle()
            return func(*args, **kwargs)
        except Exception as e:
            err_msg = str(e).lower()
            is_rate_limit = any(term in err_msg for term in ["429", "rate limit", "resource exhausted", "limit exceeded"])
            if is_rate_limit and attempt < max_retries - 1:
                delay = base_delay * (2 ** attempt) + random.uniform(0.5, 1.5)
                logger.warning(
                    "Rate limit error encountered (%s). Retrying in %.2f seconds (attempt %d/%d)...",
                    err_msg, delay, attempt + 1, max_retries
                )
                time.sleep(delay)
            else:
                raise e


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
    cache_key = _calculate_key(messages, system_prompt, temperature, max_tokens)
    cached = _get_cache(cache_key)
    if cached is not None:
        logger.info("LLM Router: Cache hit (chat) for key %s", cache_key)
        return cached

    logger.info("LLM Router: Cache miss (chat), calling API...")

    groq_err = None
    try:
        result = _call_with_backoff(groq_client.chat, messages, system_prompt, temperature, max_tokens)
        logger.debug("LLM router: used Groq (primary)")
        _set_cache(cache_key, result)
        return result
    except Exception as e:
        groq_err = e
        logger.warning("Groq failed (%s), falling back to Gemini", e)

    try:
        result = _call_with_backoff(gemini_client.chat, messages, system_prompt, temperature, max_tokens)
        logger.debug("LLM router: used Gemini (fallback)")
        _set_cache(cache_key, result)
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

    schema_name = schema.__name__
    cache_key = _calculate_key(messages, full_system, temperature, max_tokens, schema_name)
    cached = _get_cache(cache_key)
    if cached is not None:
        logger.info("LLM Router: Cache hit (structured_call) for key %s", cache_key)
        try:
            data = _extract_json(cached)
            return schema.model_validate(data)
        except Exception as parse_err:
            logger.warning("Cache parse/validation failed, invalidating and falling back to API: %s", parse_err)

    logger.info("LLM Router: Cache miss (structured_call), calling API...")

    current_messages = list(messages)
    last_error: Optional[Exception] = None

    for attempt in range(MAX_REPAIR_RETRIES + 1):
        raw = _raw_structured(current_messages, full_system, temperature, max_tokens)

        try:
            data = _extract_json(raw)
            validated = schema.model_validate(data)
            _set_cache(cache_key, raw)  # Cache the raw validated JSON string
            return validated
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
    groq_err = None
    try:
        result = _call_with_backoff(groq_client.structured_chat, messages, system_prompt, temperature, max_tokens)
        logger.debug("LLM router structured: used Groq (primary)")
        return result
    except Exception as e:
        groq_err = e
        logger.warning("Groq structured failed (%s), falling back to Gemini", e)

    try:
        result = _call_with_backoff(gemini_client.structured_chat, messages, system_prompt, temperature, max_tokens)
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
