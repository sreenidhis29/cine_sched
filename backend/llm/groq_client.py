"""
Groq client wrapper for CineSched.
Uses the Groq Python SDK (OpenAI-compatible interface).
Model: llama-3.3-70b-versatile
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from groq import Groq, APIStatusError, APITimeoutError, RateLimitError

from config import settings

logger = logging.getLogger(__name__)

_client: Optional[Groq] = None


def _get_client() -> Groq:
    global _client
    if _client is None:
        _client = Groq(api_key=settings.GROQ_API_KEY)
    return _client


def chat(
    messages: List[Dict[str, str]],
    system_prompt: str = "",
    temperature: float = 0.3,
    max_tokens: int = 4096,
) -> str:
    """
    Send a chat request to Groq and return the assistant's text.

    Raises: groq.APIStatusError / APITimeoutError / RateLimitError on failure
    — caller (router.py) handles fallback.
    """
    client = _get_client()
    all_messages: List[Dict[str, str]] = []
    if system_prompt:
        all_messages.append({"role": "system", "content": system_prompt})
    all_messages.extend(messages)

    response = client.chat.completions.create(
        model=settings.GROQ_MODEL,
        messages=all_messages,         # type: ignore[arg-type]
        temperature=temperature,
        max_tokens=max_tokens,
    )
    return response.choices[0].message.content or ""


def structured_chat(
    messages: List[Dict[str, str]],
    system_prompt: str = "",
    temperature: float = 0.1,
    max_tokens: int = 4096,
) -> str:
    """
    Same as chat() but forces JSON output mode in Groq.
    The system_prompt MUST include a JSON schema description.
    """
    client = _get_client()
    all_messages: List[Dict[str, str]] = []
    if system_prompt:
        all_messages.append({"role": "system", "content": system_prompt})
    all_messages.extend(messages)

    response = client.chat.completions.create(
        model=settings.GROQ_MODEL,
        messages=all_messages,         # type: ignore[arg-type]
        temperature=temperature,
        max_tokens=max_tokens,
        response_format={"type": "json_object"},
    )
    return response.choices[0].message.content or ""
