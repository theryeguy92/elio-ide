"""LangChain callback handler that streams trace steps to the elio-ide backend."""

from __future__ import annotations

import inspect
import os
import time
from typing import Any

import requests
from langchain_core.callbacks import BaseCallbackHandler

API_BASE = "http://localhost:8000"

# Path fragments that identify non-user frames to skip when walking the stack.
_SKIP = (
    "trace_client.py",
    "langchain",
    "site-packages",
    os.sep + "lib" + os.sep + "python",  # /lib/python3.x/ (stdlib + venv)
    "<",                                   # <frozen ...>, <string>, etc.
)


def _source_location() -> tuple[str | None, int | None]:
    """Return (filename, lineno) of the first user-code frame on the call stack.

    Walks up from the current frame, skipping langchain internals, this file,
    the Python standard library, and installed packages.
    """
    frame = inspect.currentframe()
    try:
        while frame is not None:
            fn = frame.f_code.co_filename
            if not any(pat in fn for pat in _SKIP) and os.path.isfile(fn):
                return fn, frame.f_lineno
            frame = frame.f_back
    finally:
        del frame  # break reference cycle
    return None, None


class ElioTracer(BaseCallbackHandler):
    """Sends LangChain run events to /traces/runs and /traces/runs/{id}/steps."""

    def __init__(self, run_name: str = "Agent Run") -> None:
        super().__init__()
        self.run_name = run_name
        self._run_id: str | None = None
        self._completed = False
        # lc run_id (str) → backend step id
        self._step_ids: dict[str, str] = {}
        # lc run_id (str) → monotonic start time
        self._step_starts: dict[str, float] = {}

    # ------------------------------------------------------------------
    # HTTP helpers
    # ------------------------------------------------------------------

    def _post(self, path: str, data: dict) -> dict:
        try:
            r = requests.post(f"{API_BASE}{path}", json=data, timeout=5)
            r.raise_for_status()
            return r.json()
        except Exception as exc:
            print(f"[ElioTracer] POST {path} failed: {exc}")
            return {}

    def _patch(self, path: str, data: dict) -> dict:
        try:
            r = requests.patch(f"{API_BASE}{path}", json=data, timeout=5)
            r.raise_for_status()
            return r.json()
        except Exception as exc:
            print(f"[ElioTracer] PATCH {path} failed: {exc}")
            return {}

    # ------------------------------------------------------------------
    # Chain (AgentExecutor is the top-level chain)
    # ------------------------------------------------------------------

    def on_chain_start(
        self,
        serialized: dict[str, Any],
        inputs: dict[str, Any],
        *,
        run_id: Any,
        parent_run_id: Any = None,
        **kwargs: Any,
    ) -> None:
        # Only create a backend run for the root chain
        if parent_run_id is not None or self._run_id is not None:
            return
        resp = self._post("/traces/runs", {"name": self.run_name})
        self._run_id = resp.get("id")

    def on_chain_end(
        self,
        outputs: dict[str, Any],
        *,
        run_id: Any,
        parent_run_id: Any = None,
        **kwargs: Any,
    ) -> None:
        # Fallback completion in case on_agent_finish didn't fire
        if self._run_id and parent_run_id is None and not self._completed:
            self._completed = True
            self._patch(f"/traces/runs/{self._run_id}", {"status": "completed"})

    def on_chain_error(
        self,
        error: Exception,
        *,
        run_id: Any,
        parent_run_id: Any = None,
        **kwargs: Any,
    ) -> None:
        if self._run_id and parent_run_id is None and not self._completed:
            self._completed = True
            self._patch(f"/traces/runs/{self._run_id}", {"status": "failed"})

    # ------------------------------------------------------------------
    # LLM / Chat model
    # ------------------------------------------------------------------

    def _llm_start(self, run_id: Any, input_payload: dict) -> None:
        if not self._run_id:
            return
        lc_id = str(run_id)
        self._step_starts[lc_id] = time.monotonic()
        source_file, source_line = _source_location()
        resp = self._post(
            f"/traces/runs/{self._run_id}/steps",
            {
                "type": "llm_call",
                "status": "running",
                "input": input_payload,
                "source_file": source_file,
                "source_line": source_line,
            },
        )
        if step_id := resp.get("id"):
            self._step_ids[lc_id] = step_id

    def on_llm_start(
        self,
        serialized: dict[str, Any],
        prompts: list[str],
        *,
        run_id: Any,
        **kwargs: Any,
    ) -> None:
        self._llm_start(run_id, {"messages": prompts})

    def on_chat_model_start(
        self,
        serialized: dict[str, Any],
        messages: list[list[Any]],
        *,
        run_id: Any,
        **kwargs: Any,
    ) -> None:
        formatted = [
            {"role": m.type, "content": str(m.content)[:500]}
            for batch in messages
            for m in batch
        ]
        self._llm_start(run_id, {"messages": formatted})

    def on_llm_end(self, response: Any, *, run_id: Any, **kwargs: Any) -> None:
        if not self._run_id:
            return
        lc_id = str(run_id)
        step_id = self._step_ids.pop(lc_id, None)
        if not step_id:
            return
        latency = int((time.monotonic() - self._step_starts.pop(lc_id, time.monotonic())) * 1000)

        text = ""
        token_count: int | None = None
        try:
            text = response.generations[0][0].text
        except Exception:
            text = str(response)
        try:
            usage = response.llm_output.get("token_usage", {}) if response.llm_output else {}
            token_count = usage.get("total_tokens")
        except Exception:
            pass

        payload: dict = {
            "status": "completed",
            "output": {"text": text},
            "latency_ms": latency,
        }
        if token_count is not None:
            payload["token_count"] = token_count

        self._patch(f"/traces/runs/{self._run_id}/steps/{step_id}", payload)

    def on_llm_error(self, error: Exception, *, run_id: Any, **kwargs: Any) -> None:
        if not self._run_id:
            return
        lc_id = str(run_id)
        step_id = self._step_ids.pop(lc_id, None)
        if step_id:
            self._patch(
                f"/traces/runs/{self._run_id}/steps/{step_id}",
                {"status": "failed", "output": {"error": str(error)}},
            )

    # ------------------------------------------------------------------
    # Tools
    # ------------------------------------------------------------------

    def on_tool_start(
        self,
        serialized: dict[str, Any],
        input_str: str,
        *,
        run_id: Any,
        **kwargs: Any,
    ) -> None:
        if not self._run_id:
            return
        lc_id = str(run_id)
        self._step_starts[lc_id] = time.monotonic()
        tool_name = serialized.get("name", "unknown_tool")
        source_file, source_line = _source_location()
        resp = self._post(
            f"/traces/runs/{self._run_id}/steps",
            {
                "type": "tool_call",
                "status": "running",
                "input": {"tool_name": tool_name, "input": input_str},
                "source_file": source_file,
                "source_line": source_line,
            },
        )
        if step_id := resp.get("id"):
            self._step_ids[lc_id] = step_id

    def on_tool_end(self, output: Any, *, run_id: Any, **kwargs: Any) -> None:
        if not self._run_id:
            return
        lc_id = str(run_id)
        step_id = self._step_ids.pop(lc_id, None)
        if not step_id:
            return
        latency = int((time.monotonic() - self._step_starts.pop(lc_id, time.monotonic())) * 1000)
        self._patch(
            f"/traces/runs/{self._run_id}/steps/{step_id}",
            {"status": "completed", "output": {"result": str(output)}, "latency_ms": latency},
        )

    def on_tool_error(self, error: Exception, *, run_id: Any, **kwargs: Any) -> None:
        if not self._run_id:
            return
        lc_id = str(run_id)
        step_id = self._step_ids.pop(lc_id, None)
        if step_id:
            self._patch(
                f"/traces/runs/{self._run_id}/steps/{step_id}",
                {"status": "failed", "output": {"error": str(error)}},
            )

    # ------------------------------------------------------------------
    # Agent finish
    # ------------------------------------------------------------------

    def on_agent_finish(self, finish: Any, *, run_id: Any, **kwargs: Any) -> None:
        if self._run_id and not self._completed:
            self._completed = True
            self._patch(f"/traces/runs/{self._run_id}", {"status": "completed"})
