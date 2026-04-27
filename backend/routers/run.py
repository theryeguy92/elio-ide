import asyncio
import os

from fastapi import APIRouter, WebSocket

router = APIRouter(prefix="/run", tags=["run"])

PYTHON = os.getenv("VENV_PYTHON", "/home/levey/elio-ide/.venv/bin/python")
REPO_PATH = os.getenv("GIT_REPO_PATH", "/home/levey/elio-ide")


def _resolve(file_path: str) -> str | None:
    """Resolve file_path to an absolute path within REPO_PATH, or None if invalid."""
    repo_real = os.path.realpath(REPO_PATH)
    if os.path.isabs(file_path):
        candidate = file_path
    else:
        candidate = os.path.join(REPO_PATH, file_path)
    full = os.path.realpath(candidate)
    if not full.startswith(repo_real + os.sep):
        return None
    return full


@router.websocket("/execute/ws")
async def execute_ws(ws: WebSocket, file_path: str) -> None:
    await ws.accept()

    full_path = _resolve(file_path)
    if full_path is None:
        await ws.send_json({"type": "stderr", "text": f"Access denied: {file_path}\n"})
        await ws.send_json({"type": "exit", "code": 1})
        await ws.close()
        return

    if not os.path.isfile(full_path):
        await ws.send_json({"type": "stderr", "text": f"File not found: {file_path}\n"})
        await ws.send_json({"type": "exit", "code": 1})
        await ws.close()
        return

    proc = await asyncio.create_subprocess_exec(
        PYTHON,
        full_path,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        cwd=os.path.dirname(full_path),
    )

    async def stream(pipe: asyncio.StreamReader, stype: str) -> None:
        while True:
            line = await pipe.readline()
            if not line:
                break
            try:
                await ws.send_json({"type": stype, "text": line.decode(errors="replace")})
            except Exception:
                # WS closed — kill process to unblock the sibling stream coroutine
                if proc.returncode is None:
                    proc.kill()
                return

    try:
        await asyncio.gather(
            stream(proc.stdout, "stdout"),  # type: ignore[arg-type]
            stream(proc.stderr, "stderr"),  # type: ignore[arg-type]
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
