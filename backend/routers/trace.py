import asyncio
import os
import uuid
from collections import defaultdict
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from supabase import Client, create_client

from models.trace import (
    CreateRunRequest,
    CreateStepRequest,
    Run,
    RunWithSteps,
    Step,
    UpdateRunRequest,
)

router = APIRouter(prefix="/traces", tags=["traces"])

# ---------------------------------------------------------------------------
# Supabase — lazy singleton (env vars loaded by dotenv before this module
# is imported, so initialisation is safe at first request).
# ---------------------------------------------------------------------------

_supabase: Client | None = None


def _sb() -> Client:
    global _supabase
    if _supabase is None:
        url = os.getenv("SUPABASE_URL", "")
        key = os.getenv("SUPABASE_SERVICE_KEY", "")
        if not url or not key:
            raise HTTPException(
                status_code=500,
                detail="SUPABASE_URL and SUPABASE_SERVICE_KEY are not configured",
            )
        _supabase = create_client(url, key)
    return _supabase


# ---------------------------------------------------------------------------
# In-process pub/sub for WebSocket live streaming.
# Each run_id maps to a list of per-connection asyncio Queues.
# ---------------------------------------------------------------------------

_live: dict[str, list[asyncio.Queue[dict]]] = defaultdict(list)


def _broadcast(run_id: str, payload: dict) -> None:
    for q in list(_live.get(run_id, [])):
        q.put_nowait(payload)


# ---------------------------------------------------------------------------
# POST /traces/runs
# ---------------------------------------------------------------------------


@router.post("/runs", response_model=Run, status_code=201)
async def create_run(body: CreateRunRequest) -> Run:
    sb = _sb()
    row = {
        "id": str(uuid.uuid4()),
        "name": body.name,
        "status": "running",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    result = await asyncio.to_thread(lambda: sb.table("runs").insert(row).execute())
    if not result.data:
        raise HTTPException(500, "Failed to insert run")
    return Run(**result.data[0])


# ---------------------------------------------------------------------------
# PATCH /traces/runs/{run_id}  — update status / totals
# ---------------------------------------------------------------------------


@router.patch("/runs/{run_id}", response_model=Run)
async def update_run(run_id: str, body: UpdateRunRequest) -> Run:
    sb = _sb()
    patch = body.model_dump(exclude_none=True)
    if not patch:
        raise HTTPException(400, "Nothing to update")
    result = await asyncio.to_thread(
        lambda: sb.table("runs").update(patch).eq("id", run_id).execute()
    )
    if not result.data:
        raise HTTPException(404, "Run not found")
    return Run(**result.data[0])


# ---------------------------------------------------------------------------
# POST /traces/runs/{run_id}/steps
# ---------------------------------------------------------------------------


@router.post("/runs/{run_id}/steps", response_model=Step, status_code=201)
async def append_step(run_id: str, body: CreateStepRequest) -> Step:
    sb = _sb()
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
    }
    result = await asyncio.to_thread(lambda: sb.table("steps").insert(row).execute())
    if not result.data:
        raise HTTPException(500, "Failed to insert step")
    step = Step(**result.data[0])
    # Push to any WebSocket subscribers watching this run
    _broadcast(run_id, step.model_dump(mode="json"))
    return step


# ---------------------------------------------------------------------------
# GET /traces/runs
# ---------------------------------------------------------------------------


@router.get("/runs", response_model=list[Run])
async def list_runs() -> list[Run]:
    sb = _sb()
    result = await asyncio.to_thread(
        lambda: sb.table("runs").select("*").order("created_at", desc=True).execute()
    )
    return [Run(**row) for row in result.data]


# ---------------------------------------------------------------------------
# GET /traces/runs/{run_id}
# ---------------------------------------------------------------------------


@router.get("/runs/{run_id}", response_model=RunWithSteps)
async def get_run(run_id: str) -> RunWithSteps:
    sb = _sb()

    # Fetch run and steps concurrently
    run_res, steps_res = await asyncio.gather(
        asyncio.to_thread(
            lambda: sb.table("runs")
            .select("*")
            .eq("id", run_id)
            .maybe_single()
            .execute()
        ),
        asyncio.to_thread(
            lambda: sb.table("steps")
            .select("*")
            .eq("run_id", run_id)
            .order("timestamp")
            .execute()
        ),
    )

    if not run_res.data:
        raise HTTPException(404, "Run not found")

    return RunWithSteps(
        **run_res.data,
        steps=[Step(**s) for s in steps_res.data],
    )


# ---------------------------------------------------------------------------
# DELETE /traces/runs/{run_id}
# ---------------------------------------------------------------------------


@router.delete("/runs/{run_id}", status_code=204)
async def delete_run(run_id: str) -> None:
    sb = _sb()
    await asyncio.to_thread(lambda: sb.table("runs").delete().eq("id", run_id).execute())


# ---------------------------------------------------------------------------
# WebSocket /traces/runs/{run_id}/live
#
# Streams Step payloads as they are appended via POST /steps.
# Sends {"type":"__ping__"} every 25 s to keep the connection alive.
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
