"""
Google Gemini client wrapper for CineSched using the modern google-genai SDK.
Used as FALLBACK when Groq fails/times out/rate-limits.
Model: gemini-2.5-flash
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from google import genai
from google.genai import types

from config import settings

logger = logging.getLogger(__name__)

_client: Optional[genai.Client] = None


def _get_client() -> genai.Client:
    global _client
    if _client is None:
        _client = genai.Client(api_key=settings.GEMINI_API_KEY)
    return _client


def chat(
    messages: List[Dict[str, str]],
    system_prompt: str = "",
    temperature: float = 0.3,
    max_tokens: int = 4096,
) -> str:
    """
    Send a chat request to Gemini and return the assistant's text.
    """
    client = _get_client()

    contents = []
    for msg in messages:
        role = "user" if msg["role"] == "user" else "model"
        contents.append(types.Content(role=role, parts=[types.Part.from_text(text=msg["content"])]))

    config = types.GenerateContentConfig(
        temperature=temperature,
        max_output_tokens=max_tokens,
        system_instruction=system_prompt or None,
    )

    response = client.models.generate_content(
        model=settings.GEMINI_MODEL,
        contents=contents,
        config=config,
    )

    return response.text or ""


def structured_chat(
    messages: List[Dict[str, str]],
    system_prompt: str = "",
    temperature: float = 0.1,
    max_tokens: int = 4096,
) -> str:
    """
    Same as chat() but requests JSON output from Gemini.
    """
    client = _get_client()

    contents = []
    for msg in messages:
        role = "user" if msg["role"] == "user" else "model"
        contents.append(types.Content(role=role, parts=[types.Part.from_text(text=msg["content"])]))

    config = types.GenerateContentConfig(
        temperature=temperature,
        max_output_tokens=max_tokens,
        system_instruction=(system_prompt or "") + "\n\nRespond ONLY with valid JSON.",
        response_mime_type="application/json",
    )

    response = client.models.generate_content(
        model=settings.GEMINI_MODEL,
        contents=contents,
        config=config,
    )

    return response.text or ""
