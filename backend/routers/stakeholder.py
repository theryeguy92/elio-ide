"""
Stakeholder router — builds a living architecture graph from trace data,
merged with the declared architecture from elio.agents.yaml when present.
Node descriptions come from the manifest first, then the configured LLM,
then a rule-based fallback.
"""
from __future__ import annotations

import json
import re
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from llm import chat_completion
from manifest import load_manifest, manifest_description
from storage.base import StorageBackend
from storage.deps import get_storage

router = APIRouter(prefix="/stakeholder", tags=["stakeholder"])


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

NodeType = Literal["agent", "tool", "memory"]
HealthStatus = Literal["green", "yellow", "red"]
NodeOrigin = Literal["both", "declared", "observed"]


class GraphNode(BaseModel):
    id: str
    type: NodeType
    label: str
    call_count: int
    health: HealthStatus
    origin: NodeOrigin = "observed"
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
    project: str | None = None
    project_description: str | None = None


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
# Manifest merge — declared architecture ∪ observed trace data
# ---------------------------------------------------------------------------


def _merge_manifest(
    nodes: list[GraphNode], edges: list[GraphEdge], manifest: dict
) -> tuple[list[GraphNode], list[GraphEdge]]:
    declared: dict[str, dict] = {}
    for section, ntype in (("agents", "agent"), ("tools", "tool"), ("memory", "memory")):
        entries = manifest.get(section) or []
        if not isinstance(entries, list):
            continue
        for entry in entries:
            if not isinstance(entry, dict):
                continue
            slug = _slugify(str(entry.get("id") or entry.get("label") or ""))
            if slug:
                declared[f"{ntype}_{slug}"] = {"type": ntype, **entry}

    merged: list[GraphNode] = []
    for n in nodes:
        d = declared.pop(n.id, None)
        if d is None:
            merged.append(n)  # stays origin="observed" — undocumented
        else:
            merged.append(n.model_copy(update={
                "label": str(d.get("label") or n.label),
                "origin": "both",
                "metadata": {**n.metadata, "description": str(d.get("description", ""))},
            }))

    for nid, d in declared.items():
        merged.append(GraphNode(
            id=nid,
            type=d["type"],
            label=str(d.get("label") or nid),
            call_count=0,
            health="green",
            origin="declared",
            metadata={
                "description": str(d.get("description", "")),
                "success_rate": 1.0, "error_count": 0,
                "read_count": 0, "write_count": 0,
            },
        ))

    # Declared edges that were never observed
    node_ids = {n.id for n in merged}
    have = {e.id for e in edges}
    agents = manifest.get("agents") or []
    if isinstance(agents, list):
        for entry in agents:
            if not isinstance(entry, dict):
                continue
            aid = f"agent_{_slugify(str(entry.get('id') or entry.get('label') or ''))}"
            for tid_raw in entry.get("tools") or []:
                tid = f"tool_{_slugify(str(tid_raw))}"
                eid = f"{aid}__{tid}"
                if eid not in have and aid in node_ids and tid in node_ids:
                    edges.append(GraphEdge(id=eid, source=aid, target=tid, label="calls", count=0))
                    have.add(eid)
            for mid_raw in entry.get("memory") or []:
                mid = f"memory_{_slugify(str(mid_raw))}"
                eid = f"{aid}__{mid}__declared"
                if eid not in have and aid in node_ids and mid in node_ids:
                    edges.append(GraphEdge(id=eid, source=aid, target=mid, label="uses", count=0))
                    have.add(eid)

    return merged, edges


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
        # generous budget — reasoning models (kimi-k3 et al.) spend tokens on
        # thinking before emitting content, and return "" when starved
        text = (await chat_completion(
            [{"role": "user", "content": prompt}], max_tokens=1500,
        )).strip()
        if not text:
            raise ValueError("empty LLM response")
        return text
    except Exception:
        return _rule_based(node_type, label, steps, call_count, error_count)


# ---------------------------------------------------------------------------
# GET /stakeholder/graph
# ---------------------------------------------------------------------------


@router.get("/graph", response_model=GraphResponse)
async def get_graph(
    storage: StorageBackend = Depends(get_storage),
) -> GraphResponse:
    manifest = load_manifest()
    runs = await storage.list_runs(limit=50)
    if runs:
        steps = await storage.list_all_steps([r["id"] for r in runs])
        nodes, edges = _build_graph(runs, steps)
        last_ts = str(runs[0].get("created_at", datetime.now(timezone.utc).isoformat()))
    else:
        nodes, edges = [], []
        last_ts = datetime.now(timezone.utc).isoformat()

    if manifest:
        nodes, edges = _merge_manifest(nodes, edges, manifest)

    return GraphResponse(
        nodes=nodes,
        edges=edges,
        last_updated=last_ts,
        project=str(manifest["project"]) if manifest and manifest.get("project") else None,
        project_description=(
            str(manifest["description"]) if manifest and manifest.get("description") else None
        ),
    )


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

    # Declared description wins; then LLM; then rule-based
    manifest = load_manifest()
    declared_desc = manifest_description(manifest, nid) if manifest else None
    if declared_desc:
        description = declared_desc
    else:
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
