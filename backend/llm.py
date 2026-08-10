"""Shared LLM client — Anthropic, or any OpenAI-compatible endpoint
(Kimi/Moonshot, ZAI GLM, OpenRouter, vLLM, Ollama, ...).

Config via env:
    LLM_PROVIDER   "anthropic" | "openai" (default: anthropic if
                   ANTHROPIC_API_KEY is set, else openai)
    LLM_BASE_URL   e.g. https://api.moonshot.ai/v1, http://localhost:11434/v1
    LLM_API_KEY    key for the OpenAI-compatible endpoint
    LLM_MODEL      model name for the OpenAI-compatible endpoint
    ANTHROPIC_MODEL  default claude-sonnet-4-6
"""
from __future__ import annotations

import os

import httpx
from anthropic import AsyncAnthropic

PROVIDER = os.getenv("LLM_PROVIDER", "").lower() or (
    "anthropic" if os.getenv("ANTHROPIC_API_KEY") else "openai"
)
BASE_URL = os.getenv("LLM_BASE_URL", "https://api.moonshot.ai/v1").rstrip("/")
API_KEY = os.getenv("LLM_API_KEY", "")
MODEL = os.getenv("LLM_MODEL", "kimi-k2-0905-preview")
ANTHROPIC_MODEL = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-6")

_anthropic: AsyncAnthropic | None = None


def _client() -> AsyncAnthropic:
    global _anthropic
    if _anthropic is None:
        _anthropic = AsyncAnthropic()
    return _anthropic


def current_config() -> dict[str, str]:
    """Active provider info — safe to expose to the frontend."""
    if PROVIDER == "anthropic":
        return {"provider": "anthropic", "model": ANTHROPIC_MODEL, "base_url": ""}
    return {"provider": PROVIDER, "model": MODEL, "base_url": BASE_URL}


async def chat_completion(
    messages: list[dict],
    system: str | None = None,
    max_tokens: int = 4096,
) -> str:
    """Return the assistant's reply text from the configured provider."""
    if PROVIDER == "anthropic":
        kwargs: dict = {}
        if system:
            kwargs["system"] = system
        resp = await _client().messages.create(
            model=ANTHROPIC_MODEL,
            max_tokens=max_tokens,
            messages=messages,
            **kwargs,
        )
        return resp.content[0].text

    # OpenAI-compatible path
    full_messages = ([{"role": "system", "content": system}] if system else []) + messages
    headers = {"Authorization": f"Bearer {API_KEY}"} if API_KEY else {}
    async with httpx.AsyncClient(timeout=120) as client:
        resp = await client.post(
            f"{BASE_URL}/chat/completions",
            headers=headers,
            json={"model": MODEL, "messages": full_messages, "max_tokens": max_tokens},
        )
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"]
