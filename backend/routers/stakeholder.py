"""
Stakeholder router — builds a living architecture graph from trace data
and generates plain-English node descriptions via Claude.
"""
from __future__ import annotations

import json
import os
import re
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any, Literal

import anthropic
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from supabase import Client, create_client

import asyncio

router = APIRouter(prefix="/stakeholder", tags=["stakeholder"])

# ---------------------------------------------------------------------------
# Supabase — lazy singleton (same pattern as trace router)
# ---------------------------------------------------------------------------

_supabase: Client | None = None


def _sb() -> Client:
    global _supabase
    if _supabase is None:
        url = os.getenv("SUPABASE_URL", "")
        key = os.getenv("SUPABASE_SERVICE_KEY", "")
        if not url or not key:
            raise HTTPException(500, "Supabase credentials not configured")
        _supabase = create_client(url, key)
    return _supabase


# ---------------------------------------------------------------------------
# Anthropic — lazy async singleton
# ---------------------------------------------------------------------------

_anthropic: anthropic.AsyncAnthropic | None = None


def _ai() -> anthropic.AsyncAnthropic:
    global _anthropic
    if _anthropic is None:
        key = os.getenv("ANTHROPIC_API_KEY", "")
        if not key:
            raise HTTPException(500, "ANTHROPIC_API_KEY is not configured")
        _anthropic = anthropic.AsyncAnthropic(api_key=key)
    return _anthropic


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

NodeType = Literal["agent", "tool", "memory"]
HealthStatus = Literal["green", "yellow", "red"]


class GraphNode(BaseModel):
    id: str
    type: NodeType
    label: str
    call_count: int
    health: HealthStatus
    metadata: dict[str, Any]


class GraphEdge(BaseModel):
    id: str
    source: str
    target: str
    label: str
    count: int


class GraphResponse(BaseModel):
    nodes: list[GraphNode]
    edges: list[GraphEdge]
    last_updated: str


class DescribeRequest(BaseModel):
    node_id: str


class RecentStep(BaseModel):
    type: str
    status: str
    latency_ms: int | None
    timestamp: str
    input_summary: str
    output_summary: str


class DescribeResponse(BaseModel):
    node_id: str
    label: str
    node_type: str
    description: str
    recent_steps: list[RecentStep]


class NodeHealth(BaseModel):
    status: HealthStatus
    success_rate: float
    total_calls: int
    error_count: int


class HealthResponse(BaseModel):
    nodes: dict[str, NodeHealth]
    last_updated: str


# ---------------------------------------------------------------------------
# Graph inference helpers
# ---------------------------------------------------------------------------


def _slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", text.lower()).strip("_") or "unknown"


def _unslugify(slug: str) -> str:
    return slug.replace("_", " ").title()


def _extract_tool_name(inp: Any) -> str:
    if isinstance(inp, dict):
        for key in ("tool_name", "name", "function_name", "tool", "function"):
            if key in inp:
                return str(inp[key])
    return "tool"


def _extract_memory_name(inp: Any) -> str:
    if isinstance(inp, dict):
        for key in ("store", "namespace", "collection", "database", "key"):
            if key in inp:
                return str(inp[key])
    return "memory"


def _extract_target_agent(inp: Any) -> str:
    if isinstance(inp, dict):
        for key in ("target_agent", "to", "agent", "target", "name"):
            if key in inp:
                return str(inp[key])
    return "agent"


def _summarize(value: Any, max_len: int = 140) -> str:
    if value is None:
        return ""
    text = value if isinstance(value, str) else json.dumps(value, ensure_ascii=False)
    return text[:max_len] + ("…" if len(text) > max_len else "")


def _health(call_count: int, error_count: int) -> HealthStatus:
    if call_count == 0:
        return "green"
    rate = 1.0 - error_count / call_count
    return "green" if rate >= 0.9 else "yellow" if rate >= 0.7 else "red"


def _build_graph(
    runs: list[dict], steps: list[dict]
) -> tuple[list[GraphNode], list[GraphEdge]]:
    """Infer nodes and edges from raw Supabase rows."""
    # Accumulators keyed by stable node id
    node_acc: dict[str, dict] = {}
    edge_acc: dict[str, dict] = {}
    run_to_agent: dict[str, str] = {}  # run_id → agent node id

    def _ensure_node(nid: str, ntype: NodeType, label: str) -> dict:
        if nid not in node_acc:
            node_acc[nid] = {
                "id": nid,
                "type": ntype,
                "label": label,
                "call_count": 0,
                "error_count": 0,
                "read_count": 0,
                "write_count": 0,
            }
        return node_acc[nid]

    def _ensure_edge(eid: str, src: str, tgt: str, label: str) -> dict:
        if eid not in edge_acc:
            edge_acc[eid] = {
                "id": eid,
                "source": src,
                "target": tgt,
                "label": label,
                "count": 0,
            }
        return edge_acc[eid]

    # One agent node per unique run name
    for run in runs:
        agent_id = f"agent_{_slugify(run['name'])}"
        _ensure_node(agent_id, "agent", run["name"])
        node_acc[agent_id]["call_count"] += 1
        run_to_agent[run["id"]] = agent_id

    for step in steps:
        agent_id = run_to_agent.get(step["run_id"])
        if not agent_id:
            continue

        stype = step["type"]
        status = step["status"]
        inp = step.get("input")

        if stype == "tool_call":
            tool_name = _extract_tool_name(inp)
            tool_id = f"tool_{_slugify(tool_name)}"
            n = _ensure_node(tool_id, "tool", tool_name)
            n["call_count"] += 1
            if status == "failed":
                n["error_count"] += 1
            e = _ensure_edge(f"{agent_id}__{tool_id}", agent_id, tool_id, "calls")
            e["count"] += 1

        elif stype in ("memory_read", "memory_write"):
            mem_name = _extract_memory_name(inp)
            mem_id = f"memory_{_slugify(mem_name)}"
            n = _ensure_node(mem_id, "memory", mem_name)
            n["call_count"] += 1
            if stype == "memory_read":
                n["read_count"] += 1
                edge_label = "reads from"
            else:
                n["write_count"] += 1
                edge_label = "writes to"
            e = _ensure_edge(
                f"{agent_id}__{mem_id}__{stype}",
                agent_id,
                mem_id,
                edge_label,
            )
            e["count"] += 1

        elif stype == "agent_handoff":
            target_name = _extract_target_agent(inp)
            target_id = f"agent_{_slugify(target_name)}"
            _ensure_node(target_id, "agent", target_name)
            e = _ensure_edge(
                f"{agent_id}__{target_id}__handoff",
                agent_id,
                target_id,
                "hands off to",
            )
            e["count"] += 1

    nodes = [
        GraphNode(
            id=n["id"],
            type=n["type"],
            label=n["label"],
            call_count=n["call_count"],
            health=_health(n["call_count"], n["error_count"]),
            metadata={
                "success_rate": round(
                    1.0 - n["error_count"] / n["call_count"]
                    if n["call_count"]
                    else 1.0,
                    3,
                ),
                "error_count": n["error_count"],
                "read_count": n["read_count"],
                "write_count": n["write_count"],
            },
        )
        for n in node_acc.values()
    ]

    edges = [GraphEdge(**e) for e in edge_acc.values()]
    return nodes, edges


# ---------------------------------------------------------------------------
# GET /stakeholder/graph
# ---------------------------------------------------------------------------


@router.get("/graph", response_model=GraphResponse)
async def get_graph() -> GraphResponse:
    sb = _sb()

    runs_res = await asyncio.to_thread(
        lambda: sb.table("runs")
        .select("*")
        .order("created_at", desc=True)
        .limit(50)
        .execute()
    )
    runs: list[dict] = runs_res.data or []

    if not runs:
        return GraphResponse(
            nodes=[],
            edges=[],
            last_updated=datetime.now(timezone.utc).isoformat(),
        )

    run_ids = [r["id"] for r in runs]
    steps_res = await asyncio.to_thread(
        lambda: sb.table("steps")
        .select("*")
        .in_("run_id", run_ids)
        .order("timestamp")
        .execute()
    )
    steps: list[dict] = steps_res.data or []

    nodes, edges = _build_graph(runs, steps)

    last_ts = runs[0]["created_at"] if runs else datetime.now(timezone.utc).isoformat()
    return GraphResponse(nodes=nodes, edges=edges, last_updated=str(last_ts))


# ---------------------------------------------------------------------------
# POST /stakeholder/describe
# ---------------------------------------------------------------------------


@router.post("/describe", response_model=DescribeResponse)
async def describe_node(body: DescribeRequest) -> DescribeResponse:
    sb = _sb()
    nid = body.node_id

    # Parse node type and slug from the stable id format
    if nid.startswith("agent_"):
        node_type: NodeType = "agent"
        node_slug = nid[len("agent_"):]
    elif nid.startswith("tool_"):
        node_type = "tool"
        node_slug = nid[len("tool_"):]
    elif nid.startswith("memory_"):
        node_type = "memory"
        node_slug = nid[len("memory_"):]
    else:
        raise HTTPException(400, f"Unrecognised node id format: {nid}")

    node_label = _unslugify(node_slug)

    # Fetch relevant steps
    recent_steps: list[dict] = []

    if node_type == "tool":
        res = await asyncio.to_thread(
            lambda: sb.table("steps")
            .select("*")
            .eq("type", "tool_call")
            .order("timestamp", desc=True)
            .limit(100)
            .execute()
        )
        recent_steps = [
            s
            for s in (res.data or [])
            if _slugify(_extract_tool_name(s.get("input"))) == node_slug
        ][:10]

    elif node_type == "agent":
        runs_res = await asyncio.to_thread(
            lambda: sb.table("runs")
            .select("id, name")
            .ilike("name", f"%{node_label}%")
            .limit(10)
            .execute()
        )
        run_ids = [r["id"] for r in (runs_res.data or [])]
        if run_ids:
            steps_res = await asyncio.to_thread(
                lambda: sb.table("steps")
                .select("*")
                .in_("run_id", run_ids)
                .order("timestamp", desc=True)
                .limit(20)
                .execute()
            )
            recent_steps = steps_res.data or []

    elif node_type == "memory":
        res = await asyncio.to_thread(
            lambda: sb.table("steps")
            .select("*")
            .in_("type", ["memory_read", "memory_write"])
            .order("timestamp", desc=True)
            .limit(100)
            .execute()
        )
        recent_steps = [
            s
            for s in (res.data or [])
            if _slugify(_extract_memory_name(s.get("input"))) == node_slug
        ][:10]

    # Build step summaries for Claude context
    step_lines = []
    for s in recent_steps[:8]:
        step_lines.append(
            f"  [{s['type']}] {s['status']}"
            f"{f' ({s['latency_ms']}ms)' if s.get('latency_ms') else ''}: "
            f"in={_summarize(s.get('input'), 80)} → "
            f"out={_summarize(s.get('output'), 80)}"
        )
    trace_context = "\n".join(step_lines) or "  No recorded interactions yet."

    # Prompt for Claude
    type_labels = {"agent": "AI agent", "tool": "tool or capability", "memory": "memory store"}
    prompt = (
        f"You are explaining an AI system to a non-technical business stakeholder.\n\n"
        f"Component: {type_labels[node_type]} named \"{node_label}\"\n\n"
        f"Recent activity from the system logs:\n{trace_context}\n\n"
        f"Write exactly 2 sentences in plain English:\n"
        f"1. What this {type_labels[node_type]} does (its purpose).\n"
        f"2. The value it provides to the system.\n\n"
        f"Rules: no technical jargon, no mention of APIs/JSON/tokens/code, "
        f"write as if explaining to a business executive."
    )

    ai = _ai()
    msg = await ai.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=200,
        messages=[{"role": "user", "content": prompt}],
    )
    description = msg.content[0].text.strip()

    summarized = [
        RecentStep(
            type=s["type"],
            status=s["status"],
            latency_ms=s.get("latency_ms"),
            timestamp=str(s["timestamp"]),
            input_summary=_summarize(s.get("input")),
            output_summary=_summarize(s.get("output")),
        )
        for s in recent_steps[:5]
    ]

    return DescribeResponse(
        node_id=nid,
        label=node_label,
        node_type=node_type,
        description=description,
        recent_steps=summarized,
    )


# ---------------------------------------------------------------------------
# GET /stakeholder/health
# ---------------------------------------------------------------------------


@router.get("/health", response_model=HealthResponse)
async def node_health() -> HealthResponse:
    sb = _sb()

    runs_res = await asyncio.to_thread(
        lambda: sb.table("runs")
        .select("id, name")
        .order("created_at", desc=True)
        .limit(50)
        .execute()
    )
    runs: list[dict] = runs_res.data or []

    if not runs:
        return HealthResponse(nodes={}, last_updated=datetime.now(timezone.utc).isoformat())

    run_ids = [r["id"] for r in runs]
    steps_res = await asyncio.to_thread(
        lambda: sb.table("steps")
        .select("type, status, input, run_id")
        .in_("run_id", run_ids)
        .execute()
    )
    steps: list[dict] = steps_res.data or []

    # Count totals and errors per node
    run_to_agent = {r["id"]: f"agent_{_slugify(r['name'])}" for r in runs}
    counts: dict[str, dict] = defaultdict(lambda: {"total": 0, "errors": 0})

    for step in steps:
        agent_id = run_to_agent.get(step["run_id"])
        if not agent_id:
            continue
        stype = step["type"]
        inp = step.get("input")

        if stype == "tool_call":
            nid = f"tool_{_slugify(_extract_tool_name(inp))}"
        elif stype in ("memory_read", "memory_write"):
            nid = f"memory_{_slugify(_extract_memory_name(inp))}"
        else:
            nid = agent_id

        counts[nid]["total"] += 1
        if step["status"] == "failed":
            counts[nid]["errors"] += 1

    health_map = {
        nid: NodeHealth(
            status=_health(c["total"], c["errors"]),
            success_rate=round(
                1.0 - c["errors"] / c["total"] if c["total"] else 1.0, 3
            ),
            total_calls=c["total"],
            error_count=c["errors"],
        )
        for nid, c in counts.items()
    }

    return HealthResponse(
        nodes=health_map,
        last_updated=datetime.now(timezone.utc).isoformat(),
    )
