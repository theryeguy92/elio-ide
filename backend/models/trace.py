from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel

RunStatus = Literal["running", "completed", "failed"]
StepType = Literal["llm_call", "tool_call", "agent_handoff", "memory_read", "memory_write"]
StepStatus = Literal["completed", "running", "failed"]


class Step(BaseModel):
    id: str
    run_id: str
    type: StepType
    status: StepStatus
    input: Any | None = None
    output: Any | None = None
    latency_ms: int | None = None
    token_count: int | None = None
    timestamp: datetime
    source_file: str | None = None
    source_line: int | None = None


class Run(BaseModel):
    id: str
    name: str
    status: RunStatus
    created_at: datetime
    total_tokens: int | None = None
    total_cost: float | None = None


class RunWithSteps(Run):
    steps: list[Step] = []


class CreateRunRequest(BaseModel):
    name: str


class CreateStepRequest(BaseModel):
    type: StepType
    status: StepStatus
    input: Any | None = None
    output: Any | None = None
    latency_ms: int | None = None
    token_count: int | None = None
    source_file: str | None = None
    source_line: int | None = None


class UpdateRunRequest(BaseModel):
    status: RunStatus | None = None
    total_tokens: int | None = None
    total_cost: float | None = None


class UpdateStepRequest(BaseModel):
    status: StepStatus | None = None
    output: Any | None = None
    latency_ms: int | None = None
    token_count: int | None = None
