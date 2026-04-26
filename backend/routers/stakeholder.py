"""
Stakeholder router — builds a living architecture graph from trace data.
Node descriptions use Claude when ANTHROPIC_API_KEY is set; otherwise
a rule-based fallback generates descriptions from the trace data.
"""
from __future__ import annotations

import json
import os
import re
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any, Literal

import anthropic
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from storage.base import StorageBackend
from storage.deps import get_storage

router = APIRouter(prefix="/stakeholder", tags=["stakeholder"])

# ---------------------------------------------------------------------------
# Anthropic — lazy singleton, returns None when key is absent
# ---------------------------------------------------------------------------

_anthropic_client: anthropic.AsyncAnthropic | None = None


def _ai() -> anthropic.AsyncAnthropic | None:
    global _anthropic_client
    key = os.getenv("ANTHROPIC_API_KEY", "")
    if not key:
        return None
    if _anthropic_client is None:
        _anthropic_client = anthropic.AsyncAnthropic(api_key=key)
    return _anthropic_client


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
    node_acc: dict[str, dict] = {}
    edge_acc: dict[str, dict] = {}
    run_to_agent: dict[str, str] = {}

    def _ensure_node(nid: str, ntype: NodeType, label: str) -> dict:
        if nid not in node_acc:
            node_acc[nid] = {
                "id": nid, "type": ntype, "label": label,
                "call_count": 0, "error_count": 0,
                "read_count": 0, "write_count": 0,
            }
        return node_acc[nid]

    def _ensure_edge(eid: str, src: str, tgt: str, label: str) -> dict:
        if eid not in edge_acc:
            edge_acc[eid] = {"id": eid, "source": src, "target": tgt, "label": label, "count": 0}
        return edge_acc[eid]

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
        inp = step.get("input")

        if stype == "tool_call":
            tool_id = f"tool_{_slugify(_extract_tool_name(inp))}"
            n = _ensure_node(tool_id, "tool", _extract_tool_name(inp))
            n["call_count"] += 1
            if step["status"] == "failed":
                n["error_count"] += 1
            _ensure_edge(f"{agent_id}__{tool_id}", agent_id, tool_id, "calls")["count"] += 1

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
            _ensure_edge(
                f"{agent_id}__{mem_id}__{stype}", agent_id, mem_id, edge_label
            )["count"] += 1

        elif stype == "agent_handoff":
            target_name = _extract_target_agent(inp)
            target_id = f"agent_{_slugify(target_name)}"
            _ensure_node(target_id, "agent", target_name)
            _ensure_edge(
                f"{agent_id}__{target_id}__handoff", agent_id, target_id, "hands off to"
            )["count"] += 1

    nodes = [
        GraphNode(
            id=n["id"], type=n["type"], label=n["label"], call_count=n["call_count"],
            health=_health(n["call_count"], n["error_count"]),
            metadata={
                "success_rate": round(
                    1.0 - n["error_count"] / n["call_count"] if n["call_count"] else 1.0, 3
                ),
                "error_count": n["error_count"],
                "read_count": n["read_count"],
                "write_count": n["write_count"],
            },
        )
        for n in node_acc.values()
    ]
    return nodes, [GraphEdge(**e) for e in edge_acc.values()]


# ---------------------------------------------------------------------------
# Description generation — Claude if available, rule-based otherwise
# ---------------------------------------------------------------------------


def _rule_based(
    node_type: str, label: str, steps: list[dict], call_count: int, error_count: int
) -> str:
    pct = round((1.0 - error_count / call_count) * 100) if call_count else 100
    n = call_count
    s = "" if n == 1 else "s"

    if node_type == "agent":
        return (
            f"{label} is an AI agent that orchestrates tasks and coordinates tools "
            f"and memory to complete goals. "
            f"It has run {n} time{s} with a {pct}% success rate."
        )
    if node_type == "tool":
        return (
            f"{label} is a capability the agent calls to perform specific actions "
            f"or retrieve information. "
            f"It has been invoked {n} time{s} with a {pct}% success rate."
        )
    if node_type == "memory":
        reads = sum(1 for st in steps if st.get("type") == "memory_read")
        writes = sum(1 for st in steps if st.get("type") == "memory_write")
        return (
            f"{label} is a storage component that persists information the agent "
            f"needs across interactions. "
            f"It has handled {n} operation{s} ({reads} reads, {writes} writes) "
            f"with a {pct}% reliability rate."
        )
    return f"{label} is a system component that plays a key role in the AI workflow."


async def _generate_description(
    node_type: str, label: str, steps: list[dict], call_count: int, error_count: int
) -> str:
    ai = _ai()
    if ai:
        step_lines = []
        for s in steps[:8]:
            lat = f" ({s['latency_ms']}ms)" if s.get("latency_ms") else ""
            step_lines.append(
                f"  [{s['type']}] {s['status']}{lat}: "
                f"in={_summarize(s.get('input'), 80)} → out={_summarize(s.get('output'), 80)}"
            )
        trace_context = "\n".join(step_lines) or "  No recorded interactions yet."
        type_labels = {"agent": "AI agent", "tool": "tool or capability", "memory": "memory store"}
        prompt = (
            f"You are explaining an AI system to a non-technical business stakeholder.\n\n"
            f"Component: {type_labels[node_type]} named \"{label}\"\n\n"
            f"Recent activity from the system logs:\n{trace_context}\n\n"
            f"Write exactly 2 sentences in plain English:\n"
            f"1. What this {type_labels[node_type]} does (its purpose).\n"
            f"2. The value it provides to the system.\n\n"
            f"Rules: no technical jargon, no mention of APIs/JSON/tokens/code, "
            f"write as if explaining to a business executive."
        )
        try:
            msg = await ai.messages.create(
                model="claude-sonnet-4-6",
                max_tokens=200,
                messages=[{"role": "user", "content": prompt}],
            )
            return msg.content[0].text.strip()
        except Exception:
            pass

    return _rule_based(node_type, label, steps, call_count, error_count)


# ---------------------------------------------------------------------------
# GET /stakeholder/graph
# ---------------------------------------------------------------------------


@router.get("/graph", response_model=GraphResponse)
async def get_graph(
    storage: StorageBackend = Depends(get_storage),
) -> GraphResponse:
    runs = await storage.list_runs(limit=50)
    if not runs:
        return GraphResponse(
            nodes=[], edges=[], last_updated=datetime.now(timezone.utc).isoformat()
        )
    run_ids = [r["id"] for r in runs]
    steps = await storage.list_all_steps(run_ids)
    nodes, edges = _build_graph(runs, steps)
    last_ts = runs[0].get("created_at", datetime.now(timezone.utc).isoformat())
    return GraphResponse(nodes=nodes, edges=edges, last_updated=str(last_ts))


# ---------------------------------------------------------------------------
# POST /stakeholder/describe
# ---------------------------------------------------------------------------


@router.post("/describe", response_model=DescribeResponse)
async def describe_node(
    body: DescribeRequest,
    storage: StorageBackend = Depends(get_storage),
) -> DescribeResponse:
    nid = body.node_id
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

    runs = await storage.list_runs(limit=50)
    run_ids = [r["id"] for r in runs]
    all_steps = await storage.list_all_steps(run_ids)

    if node_type == "tool":
        recent = [
            s for s in all_steps
            if s["type"] == "tool_call"
            and _slugify(_extract_tool_name(s.get("input"))) == node_slug
        ][-10:]
    elif node_type == "agent":
        relevant = {r["id"] for r in runs if node_label.lower() in r["name"].lower()}
        recent = [s for s in all_steps if s["run_id"] in relevant][-20:]
    else:
        recent = [
            s for s in all_steps
            if s["type"] in ("memory_read", "memory_write")
            and _slugify(_extract_memory_name(s.get("input"))) == node_slug
        ][-10:]

    call_count = len(recent)
    error_count = sum(1 for s in recent if s.get("status") == "failed")

    description = await _generate_description(
        node_type, node_label, recent, call_count, error_count
    )

    return DescribeResponse(
        node_id=nid,
        label=node_label,
        node_type=node_type,
        description=description,
        recent_steps=[
            RecentStep(
                type=s["type"],
                status=s["status"],
                latency_ms=s.get("latency_ms"),
                timestamp=str(s.get("timestamp", "")),
                input_summary=_summarize(s.get("input")),
                output_summary=_summarize(s.get("output")),
            )
            for s in recent[:5]
        ],
    )


# ---------------------------------------------------------------------------
# GET /stakeholder/health
# ---------------------------------------------------------------------------


@router.get("/health", response_model=HealthResponse)
async def node_health(
    storage: StorageBackend = Depends(get_storage),
) -> HealthResponse:
    runs = await storage.list_runs(limit=50)
    if not runs:
        return HealthResponse(nodes={}, last_updated=datetime.now(timezone.utc).isoformat())

    run_ids = [r["id"] for r in runs]
    steps = await storage.list_all_steps(run_ids)

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

    return HealthResponse(
        nodes={
            nid: NodeHealth(
                status=_health(c["total"], c["errors"]),
                success_rate=round(
                    1.0 - c["errors"] / c["total"] if c["total"] else 1.0, 3
                ),
                total_calls=c["total"],
                error_count=c["errors"],
            )
            for nid, c in counts.items()
        },
        last_updated=datetime.now(timezone.utc).isoformat(),
    )
