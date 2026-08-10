"""Shared LLM client — Anthropic, or any OpenAI-compatible endpoint
(Kimi/Moonshot, ZAI GLM, OpenRouter, vLLM, Ollama, ...).

Reads runtime settings (config.json) with .env as fallback, so provider
changes from the Settings UI apply without a restart.
"""
from __future__ import annotations

import os

import httpx
from anthropic import AsyncAnthropic

from config import settings


def _provider() -> str:
    explicit = settings.get("llm_provider").lower()
    if explicit:
        return explicit
    return "anthropic" if settings.get("anthropic_api_key") else "openai"


def _base_url() -> str:
    return settings.get("llm_base_url", "https://api.moonshot.ai/v1").rstrip("/")


def _api_key() -> str:
    return settings.get("llm_api_key")


def _model() -> str:
    return settings.get("llm_model", "kimi-k2-0905-preview")


def _anthropic_model() -> str:
    return os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-6")


_anthropic: AsyncAnthropic | None = None


def _client() -> AsyncAnthropic:
    global _anthropic
    if _anthropic is None:
        _anthropic = AsyncAnthropic(api_key=settings.get("anthropic_api_key") or None)
    return _anthropic


def current_config() -> dict[str, str]:
    """Active provider info — safe to expose to the frontend."""
    if _provider() == "anthropic":
        return {"provider": "anthropic", "model": _anthropic_model(), "base_url": ""}
    return {"provider": _provider(), "model": _model(), "base_url": _base_url()}


async def chat_completion(
    messages: list[dict],
    system: str | None = None,
    max_tokens: int = 4096,
) -> str:
    """Return the assistant's reply text from the configured provider."""
    if _provider() == "anthropic":
        kwargs: dict = {}
        if system:
            kwargs["system"] = system
        resp = await _client().messages.create(
            model=_anthropic_model(),
            max_tokens=max_tokens,
            messages=messages,
            **kwargs,
        )
        return resp.content[0].text

    # OpenAI-compatible path
    full_messages = ([{"role": "system", "content": system}] if system else []) + messages
    headers = {"Authorization": f"Bearer {_api_key()}"} if _api_key() else {}
    async with httpx.AsyncClient(timeout=120) as client:
        resp = await client.post(
            f"{_base_url()}/chat/completions",
            headers=headers,
            json={"model": _model(), "messages": full_messages, "max_tokens": max_tokens},
        )
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"]
