import asyncio
import uuid
from collections import defaultdict
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect

from models.trace import (
    CreateRunRequest,
    CreateStepRequest,
    Run,
    RunWithSteps,
    Step,
    UpdateRunRequest,
    UpdateStepRequest,
)
from storage.base import StorageBackend
from storage.deps import get_storage

router = APIRouter(prefix="/traces", tags=["traces"])

# ---------------------------------------------------------------------------
# In-process pub/sub for WebSocket live streaming
# ---------------------------------------------------------------------------

_live: dict[str, list[asyncio.Queue[dict]]] = defaultdict(list)


def _broadcast(run_id: str, payload: dict) -> None:
    for q in list(_live.get(run_id, [])):
        q.put_nowait(payload)


# ---------------------------------------------------------------------------
# POST /traces/runs
# ---------------------------------------------------------------------------


@router.post("/runs", response_model=Run, status_code=201)
async def create_run(
    body: CreateRunRequest,
    storage: StorageBackend = Depends(get_storage),
) -> Run:
    row = {
        "id": str(uuid.uuid4()),
        "name": body.name,
        "status": "running",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    result = await storage.create_run(row)
    return Run(**result)


# ---------------------------------------------------------------------------
# PATCH /traces/runs/{run_id}
# ---------------------------------------------------------------------------


@router.patch("/runs/{run_id}", response_model=Run)
async def update_run(
    run_id: str,
    body: UpdateRunRequest,
    storage: StorageBackend = Depends(get_storage),
) -> Run:
    patch = body.model_dump(exclude_none=True)
    if not patch:
        raise HTTPException(400, "Nothing to update")
    result = await storage.update_run(run_id, patch)
    if not result:
        raise HTTPException(404, "Run not found")
    return Run(**result)


# ---------------------------------------------------------------------------
# POST /traces/runs/{run_id}/steps
# ---------------------------------------------------------------------------


@router.post("/runs/{run_id}/steps", response_model=Step, status_code=201)
async def append_step(
    run_id: str,
    body: CreateStepRequest,
    storage: StorageBackend = Depends(get_storage),
) -> Step:
    row = {
        "id": str(uuid.uuid4()),
        "run_id": run_id,
        "type": body.type,
        "status": body.status,
        "input": body.input,
        "output": body.output,
        "latency_ms": body.latency_ms,
        "token_count": body.token_count,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "source_file": body.source_file,
        "source_line": body.source_line,
    }
    result = await storage.create_step(row)
    step = Step(**result)
    _broadcast(run_id, step.model_dump(mode="json"))
    return step


# ---------------------------------------------------------------------------
# PATCH /traces/runs/{run_id}/steps/{step_id}
# ---------------------------------------------------------------------------


@router.patch("/runs/{run_id}/steps/{step_id}", response_model=Step)
async def update_step(
    run_id: str,
    step_id: str,
    body: UpdateStepRequest,
    storage: StorageBackend = Depends(get_storage),
) -> Step:
    patch = body.model_dump(exclude_none=True)
    if not patch:
        raise HTTPException(400, "Nothing to update")
    result = await storage.update_step(step_id, patch, run_id=run_id)
    if not result:
        raise HTTPException(404, "Step not found")
    step = Step(**result)
    _broadcast(run_id, step.model_dump(mode="json"))
    return step


# ---------------------------------------------------------------------------
# GET /traces/runs
# ---------------------------------------------------------------------------


@router.get("/runs", response_model=list[Run])
async def list_runs(
    storage: StorageBackend = Depends(get_storage),
) -> list[Run]:
    rows = await storage.list_runs()
    return [Run(**r) for r in rows]


# ---------------------------------------------------------------------------
# GET /traces/runs/{run_id}
# ---------------------------------------------------------------------------


@router.get("/runs/{run_id}", response_model=RunWithSteps)
async def get_run(
    run_id: str,
    storage: StorageBackend = Depends(get_storage),
) -> RunWithSteps:
    run_row, steps_rows = await asyncio.gather(
        storage.get_run(run_id),
        storage.list_steps(run_id),
    )
    if not run_row:
        raise HTTPException(404, "Run not found")
    return RunWithSteps(**run_row, steps=[Step(**s) for s in steps_rows])


# ---------------------------------------------------------------------------
# DELETE /traces/runs/{run_id}
# ---------------------------------------------------------------------------


@router.delete("/runs/{run_id}", status_code=204)
async def delete_run(
    run_id: str,
    storage: StorageBackend = Depends(get_storage),
) -> None:
    await storage.delete_run(run_id)


# ---------------------------------------------------------------------------
# WebSocket /traces/runs/{run_id}/live
# ---------------------------------------------------------------------------


@router.websocket("/runs/{run_id}/live")
async def live_steps(ws: WebSocket, run_id: str) -> None:
    await ws.accept()
    q: asyncio.Queue[dict] = asyncio.Queue()
    _live[run_id].append(q)
    try:
        while True:
            try:
                payload = await asyncio.wait_for(q.get(), timeout=25.0)
                await ws.send_json(payload)
            except asyncio.TimeoutError:
                await ws.send_json({"type": "__ping__"})
    except (WebSocketDisconnect, Exception):
        pass
    finally:
        if q in _live[run_id]:
            _live[run_id].remove(q)
        if not _live[run_id]:
            _live.pop(run_id, None)
