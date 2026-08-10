"""Runtime settings — persisted to backend/config.json, with .env as fallback.

Routers read via `settings.get(...)` at request time so changes apply
without a restart. Secrets are masked when read back out.
"""
from __future__ import annotations

import json
import os
from pathlib import Path

CONFIG_PATH = Path(__file__).parent / "config.json"

MASK = "••••••••"

# field → env fallback
_ENV_MAP = {
    "project_path": "GIT_REPO_PATH",
    "vault_path": "VAULT_PATH",
    "llm_provider": "LLM_PROVIDER",
    "llm_base_url": "LLM_BASE_URL",
    "llm_api_key": "LLM_API_KEY",
    "llm_model": "LLM_MODEL",
    "anthropic_api_key": "ANTHROPIC_API_KEY",
    "runpod_api_key": "RUNPOD_API_KEY",
}

_SECRETS = {"llm_api_key", "anthropic_api_key", "runpod_api_key"}


class Settings:
    def __init__(self) -> None:
        self._data: dict[str, str] = {}
        if CONFIG_PATH.is_file():
            try:
                self._data = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
            except json.JSONDecodeError:
                self._data = {}

    def get(self, key: str, default: str = "") -> str:
        """Effective value: config.json wins, then env, then default."""
        val = self._data.get(key)
        if val:
            return val
        env_var = _ENV_MAP.get(key)
        if env_var:
            return os.getenv(env_var, default)
        return default

    def update(self, data: dict[str, str]) -> None:
        for key, value in data.items():
            if key not in _ENV_MAP or value == MASK:
                continue
            if value:
                self._data[key] = value
            else:
                self._data.pop(key, None)
        CONFIG_PATH.write_text(json.dumps(self._data, indent=2) + "\n", encoding="utf-8")

    def public(self) -> dict[str, str]:
        """All fields, secrets masked."""
        out: dict[str, str] = {}
        for key in _ENV_MAP:
            val = self.get(key)
            out[key] = MASK if key in _SECRETS and val else val
        return out

    @property
    def needs_setup(self) -> bool:
        return not CONFIG_PATH.is_file()


settings = Settings()
