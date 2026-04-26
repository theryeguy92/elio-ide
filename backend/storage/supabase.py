from __future__ import annotations

import asyncio
import os

from supabase import Client, create_client

from .base import StorageBackend


class SupabaseStorage(StorageBackend):
    def __init__(self) -> None:
        url = os.getenv("SUPABASE_URL", "")
        key = os.getenv("SUPABASE_SERVICE_KEY", "")
        if not url or not key:
            raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set")
        self._sb: Client = create_client(url, key)

    # ------------------------------------------------------------------
    # Runs
    # ------------------------------------------------------------------

    async def create_run(self, row: dict) -> dict:
        result = await asyncio.to_thread(
            lambda: self._sb.table("runs").insert(row).execute()
        )
        return result.data[0]

    async def update_run(self, run_id: str, patch: dict) -> dict:
        _patch = patch

        def _run():
            return self._sb.table("runs").update(_patch).eq("id", run_id).execute()

        result = await asyncio.to_thread(_run)
        return result.data[0]

    async def get_run(self, run_id: str) -> dict | None:
        result = await asyncio.to_thread(
            lambda: self._sb.table("runs")
            .select("*")
            .eq("id", run_id)
            .maybe_single()
            .execute()
        )
        return result.data

    async def list_runs(self, limit: int = 50) -> list[dict]:
        result = await asyncio.to_thread(
            lambda: self._sb.table("runs")
            .select("*")
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        return result.data or []

    async def delete_run(self, run_id: str) -> None:
        await asyncio.to_thread(
            lambda: self._sb.table("runs").delete().eq("id", run_id).execute()
        )

    # ------------------------------------------------------------------
    # Steps
    # ------------------------------------------------------------------

    async def create_step(self, row: dict) -> dict:
        result = await asyncio.to_thread(
            lambda: self._sb.table("steps").insert(row).execute()
        )
        return result.data[0]

    async def update_step(
        self, step_id: str, patch: dict, run_id: str | None = None
    ) -> dict | None:
        _patch, _step_id, _run_id = patch, step_id, run_id

        def _run():
            q = self._sb.table("steps").update(_patch).eq("id", _step_id)
            if _run_id:
                q = q.eq("run_id", _run_id)
            return q.execute()

        result = await asyncio.to_thread(_run)
        return result.data[0] if result.data else None

    async def list_steps(self, run_id: str) -> list[dict]:
        result = await asyncio.to_thread(
            lambda: self._sb.table("steps")
            .select("*")
            .eq("run_id", run_id)
            .order("timestamp")
            .execute()
        )
        return result.data or []

    async def list_all_steps(self, run_ids: list[str] | None = None) -> list[dict]:
        if run_ids is not None and not run_ids:
            return []
        _run_ids = run_ids

        def _run():
            q = self._sb.table("steps").select("*")
            if _run_ids:
                q = q.in_("run_id", _run_ids)
            return q.order("timestamp").execute()

        result = await asyncio.to_thread(_run)
        return result.data or []
