"""Settings router — read/update runtime config, test LLM connectivity."""
from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from config import settings

router = APIRouter(prefix="/settings", tags=["settings"])


class SettingsResponse(BaseModel):
    project_path: str
    vault_path: str
    llm_provider: str
    llm_base_url: str
    llm_api_key: str
    llm_model: str
    anthropic_api_key: str
    runpod_api_key: str
    needs_setup: bool


class SettingsUpdate(BaseModel):
    project_path: str | None = None
    vault_path: str | None = None
    llm_provider: str | None = None
    llm_base_url: str | None = None
    llm_api_key: str | None = None
    llm_model: str | None = None
    anthropic_api_key: str | None = None
    runpod_api_key: str | None = None


class TestResult(BaseModel):
    ok: bool
    detail: str


@router.get("", response_model=SettingsResponse)
async def get_settings() -> SettingsResponse:
    return SettingsResponse(**settings.public(), needs_setup=settings.needs_setup)


@router.post("", response_model=SettingsResponse)
async def update_settings(body: SettingsUpdate) -> SettingsResponse:
    data = {k: v for k, v in body.model_dump().items() if v is not None}

    for path_field in ("project_path", "vault_path"):
        val = data.get(path_field)
        if val and not Path(val).is_dir():
            raise HTTPException(
                status_code=400,
                detail=f"{path_field}: directory does not exist: {val}",
            )

    provider = data.get("llm_provider")
    if provider and provider not in ("anthropic", "openai"):
        raise HTTPException(status_code=400, detail="llm_provider must be 'anthropic' or 'openai'")

    settings.update(data)
    return SettingsResponse(**settings.public(), needs_setup=settings.needs_setup)


@router.post("/test-llm", response_model=TestResult)
async def test_llm() -> TestResult:
    """Ping the configured LLM with a 1-token completion."""
    from llm import chat_completion, current_config

    try:
        await chat_completion([{"role": "user", "content": "ping"}], max_tokens=1)
    except Exception as exc:
        cfg = current_config()
        return TestResult(ok=False, detail=f"{cfg['provider']} · {cfg['model']}: {exc}")
    cfg = current_config()
    return TestResult(ok=True, detail=f"{cfg['provider']} · {cfg['model']} responded")
