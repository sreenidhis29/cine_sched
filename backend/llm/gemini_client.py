"""
Google Gemini client wrapper for CineSched.
Used as FALLBACK when Groq fails/times out/rate-limits.
Model: gemini-2.5-flash
"""
from __future__ import annotations

import json
import logging
from typing import Any, Dict, List, Optional

import google.generativeai as genai

from config import settings

logger = logging.getLogger(__name__)

_configured = False


def _ensure_configured() -> None:
    global _configured
    if not _configured:
        genai.configure(api_key=settings.GEMINI_API_KEY)
        _configured = True


def chat(
    messages: List[Dict[str, str]],
    system_prompt: str = "",
    temperature: float = 0.3,
    max_tokens: int = 4096,
) -> str:
    """
    Send a chat request to Gemini and return the assistant's text.

    Raises: google.api_core.exceptions.* on failure — caller (router.py) handles.
    """
    _ensure_configured()
    model = genai.GenerativeModel(
        model_name=settings.GEMINI_MODEL,
        system_instruction=system_prompt or None,
        generation_config=genai.GenerationConfig(
            temperature=temperature,
            max_output_tokens=max_tokens,
        ),
    )

    # Convert OpenAI-style messages to Gemini history format
    history = []
    last_user_msg = ""
    for msg in messages:
        role = "user" if msg["role"] == "user" else "model"
        if msg["role"] == "user":
            last_user_msg = msg["content"]
            history.append({"role": role, "parts": [msg["content"]]})
        elif msg["role"] == "assistant":
            history.append({"role": "model", "parts": [msg["content"]]})

    # Gemini chat session
    if len(history) <= 1:
        response = model.generate_content(last_user_msg or (messages[-1]["content"] if messages else ""))
    else:
        chat_session = model.start_chat(history=history[:-1])
        response = chat_session.send_message(last_user_msg)

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
    _ensure_configured()
    model = genai.GenerativeModel(
        model_name=settings.GEMINI_MODEL,
        system_instruction=(system_prompt or "") + "\n\nRespond ONLY with valid JSON.",
        generation_config=genai.GenerationConfig(
            temperature=temperature,
            max_output_tokens=max_tokens,
            response_mime_type="application/json",
        ),
    )

    history = []
    last_user_msg = ""
    for msg in messages:
        if msg["role"] == "user":
            last_user_msg = msg["content"]
            history.append({"role": "user", "parts": [msg["content"]]})
        elif msg["role"] == "assistant":
            history.append({"role": "model", "parts": [msg["content"]]})

    if len(history) <= 1:
        response = model.generate_content(last_user_msg or (messages[-1]["content"] if messages else ""))
    else:
        chat_session = model.start_chat(history=history[:-1])
        response = chat_session.send_message(last_user_msg)

    return response.text or ""
