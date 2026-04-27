"""Compute settings router — GPU info, model listing, API key management."""
from __future__ import annotations

import os
import subprocess
from pathlib import Path

import httpx
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/compute", tags=["compute"])

OLLAMA_BASE = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
_ENV_PATH = Path(os.getenv("GIT_REPO_PATH", "/home/levey/elio-ide")) / "backend" / ".env"


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class OllamaStatus(BaseModel):
    running: bool
    base_url: str


class GpuInfo(BaseModel):
    name: str
    memory_total_mb: int
    memory_used_mb: int
    utilization_pct: int | None = None


class ComputeStatus(BaseModel):
    ollama: OllamaStatus
    gpus: list[GpuInfo]


class ModelEntry(BaseModel):
    id: str
    name: str
    provider: str          # "ollama" | "openai" | "anthropic"
    size_gb: float | None = None


class ComputeModels(BaseModel):
    models: list[ModelEntry]
    active_model: str | None


class SettingsPayload(BaseModel):
    RUNPOD_API_KEY: str | None = None
    LAMBDA_LABS_API_KEY: str | None = None
    ANTHROPIC_API_KEY: str | None = None
    OPENAI_API_KEY: str | None = None
    ACTIVE_MODEL: str | None = None


class SettingsMeta(BaseModel):
    RUNPOD_API_KEY: bool
    LAMBDA_LABS_API_KEY: bool
    ANTHROPIC_API_KEY: bool
    OPENAI_API_KEY: bool
    ACTIVE_MODEL: str | None


# ---------------------------------------------------------------------------
# .env helpers
# ---------------------------------------------------------------------------

def _read_env() -> dict[str, str]:
    if not _ENV_PATH.exists():
        return {}
    result: dict[str, str] = {}
    for raw in _ENV_PATH.read_text().splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, val = line.partition("=")
        result[key.strip()] = val.strip().strip('"').strip("'")
    return result


def _write_env(updates: dict[str, str]) -> None:
    existing = _read_env()
    existing.update(updates)
    lines = [f'{k}="{v}"' for k, v in existing.items()]
    _ENV_PATH.write_text("\n".join(lines) + "\n")


def _get(key: str) -> str:
    return os.getenv(key) or _read_env().get(key, "")


# ---------------------------------------------------------------------------
# System helpers
# ---------------------------------------------------------------------------

async def _ollama_models() -> list[ModelEntry]:
    try:
        async with httpx.AsyncClient(timeout=4.0) as client:
            resp = await client.get(f"{OLLAMA_BASE}/api/tags")
            resp.raise_for_status()
            models = []
            for m in resp.json().get("models", []):
                name = m.get("name", "")
                size = m.get("size", 0)
                models.append(ModelEntry(
                    id=f"ollama/{name}",
                    name=name,
                    provider="ollama",
                    size_gb=round(size / 1e9, 1) if size else None,
                ))
            return models
    except Exception:
        return []


def _gpu_info() -> list[GpuInfo]:
    try:
        proc = subprocess.run(
            [
                "nvidia-smi",
                "--query-gpu=name,memory.total,memory.used,utilization.gpu",
                "--format=csv,noheader,nounits",
            ],
            capture_output=True, text=True, timeout=5,
        )
        if proc.returncode != 0:
            return []
        gpus = []
        for line in proc.stdout.strip().splitlines():
            parts = [p.strip() for p in line.split(",")]
            if len(parts) < 3:
                continue
            name = parts[0]
            total = int(parts[1]) if parts[1].isdigit() else 0
            used = int(parts[2]) if parts[2].isdigit() else 0
            util = int(parts[3]) if len(parts) > 3 and parts[3].isdigit() else None
            gpus.append(GpuInfo(
                name=name,
                memory_total_mb=total,
                memory_used_mb=used,
                utilization_pct=util,
            ))
        return gpus
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return []


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/status", response_model=ComputeStatus)
async def compute_status() -> ComputeStatus:
    ollama_running = False
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            r = await client.get(f"{OLLAMA_BASE}/api/tags")
            ollama_running = r.status_code == 200
    except Exception:
        pass

    return ComputeStatus(
        ollama=OllamaStatus(running=ollama_running, base_url=OLLAMA_BASE),
        gpus=_gpu_info(),
    )


@router.get("/models", response_model=ComputeModels)
async def list_models() -> ComputeModels:
    models: list[ModelEntry] = await _ollama_models()

    if _get("OPENAI_API_KEY"):
        for name in ["gpt-4o", "gpt-4o-mini", "o1", "o3-mini"]:
            models.append(ModelEntry(id=f"openai/{name}", name=name, provider="openai"))

    if _get("ANTHROPIC_API_KEY"):
        for name in ["claude-opus-4-7", "claude-sonnet-4-6", "claude-haiku-4-5-20251001"]:
            models.append(ModelEntry(id=f"anthropic/{name}", name=name, provider="anthropic"))

    return ComputeModels(models=models, active_model=_get("ACTIVE_MODEL") or None)


@router.get("/settings", response_model=SettingsMeta)
async def get_settings() -> SettingsMeta:
    return SettingsMeta(
        RUNPOD_API_KEY=bool(_get("RUNPOD_API_KEY")),
        LAMBDA_LABS_API_KEY=bool(_get("LAMBDA_LABS_API_KEY")),
        ANTHROPIC_API_KEY=bool(_get("ANTHROPIC_API_KEY")),
        OPENAI_API_KEY=bool(_get("OPENAI_API_KEY")),
        ACTIVE_MODEL=_get("ACTIVE_MODEL") or None,
    )


@router.post("/settings", response_model=SettingsMeta)
async def save_settings(body: SettingsPayload) -> SettingsMeta:
    updates: dict[str, str] = {}
    for field, val in body.model_dump().items():
        if val:  # skip empty / None — don't overwrite with blank
            updates[field] = val
            os.environ[field] = val
    if updates:
        _write_env(updates)
    return await get_settings()
