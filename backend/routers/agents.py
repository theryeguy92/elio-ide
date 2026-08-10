"""Agents router — launch external agent CLIs (Claude Code, Pi) in one-shot
mode and stream output to the IDE terminal over a WebSocket.

ponytail: no PTY — one-shot `-p` mode only, so interactive prompts inside
the CLI won't work. Upgrade path: node-pty-style session streaming.
"""
from __future__ import annotations

import asyncio
import shutil

from fastapi import APIRouter, WebSocket

from config import settings

router = APIRouter(prefix="/agents", tags=["agents"])

AGENTS = {
    "claude": "Claude Code",
    "pi": "Pi Agent",
}


@router.get("")
async def list_agents() -> list[dict]:
    """Which agent CLIs are installed on this machine."""
    return [
        {
            "id": agent_id,
            "name": name,
            "available": shutil.which(agent_id) is not None,
            "path": shutil.which(agent_id) or "",
        }
        for agent_id, name in AGENTS.items()
    ]


async def _stream(pipe: asyncio.StreamReader, stype: str, ws: WebSocket, proc) -> None:
    while True:
        line = await pipe.readline()
        if not line:
            break
        try:
            await ws.send_json({"type": stype, "text": line.decode(errors="replace")})
        except Exception:
            if proc.returncode is None:
                proc.kill()
            return


@router.websocket("/run/ws")
async def run_agent_ws(ws: WebSocket, cli: str, prompt: str) -> None:
    await ws.accept()

    async def fail(msg: str) -> None:
        await ws.send_json({"type": "stderr", "text": f"{msg}\n"})
        await ws.send_json({"type": "exit", "code": 1})
        await ws.close()

    if cli not in AGENTS:
        await fail(f"Unknown agent: {cli}")
        return
    exe = shutil.which(cli)
    if not exe:
        await fail(f"{AGENTS[cli]} is not installed (no '{cli}' on PATH)")
        return
    if not prompt.strip():
        await fail("Empty prompt")
        return

    proc = await asyncio.create_subprocess_exec(
        exe,
        "-p",
        prompt,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        cwd=settings.get("project_path", "."),
    )

    try:
        await asyncio.gather(
            _stream(proc.stdout, "stdout", ws, proc),  # type: ignore[arg-type]
            _stream(proc.stderr, "stderr", ws, proc),  # type: ignore[arg-type]
        )
        code = await proc.wait()
        try:
            await ws.send_json({"type": "exit", "code": code})
        except Exception:
            pass
    finally:
        if proc.returncode is None:
            proc.kill()
            await proc.wait()
