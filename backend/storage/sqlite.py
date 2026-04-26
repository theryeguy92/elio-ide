from __future__ import annotations

import json
import os
import sqlite3

import aiosqlite

from .base import StorageBackend

_THIS_DIR = os.path.dirname(os.path.abspath(__file__))
_DEFAULT_DB = os.path.join(_THIS_DIR, "..", "local.db")

_SCHEMA = """
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS runs (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'running',
    created_at  TEXT NOT NULL,
    total_tokens INTEGER,
    total_cost  REAL
);

CREATE TABLE IF NOT EXISTS steps (
    id          TEXT PRIMARY KEY,
    run_id      TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
    type        TEXT NOT NULL,
    status      TEXT NOT NULL,
    input       TEXT,
    output      TEXT,
    latency_ms  INTEGER,
    token_count INTEGER,
    timestamp   TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS steps_run_id_idx ON steps(run_id);
CREATE INDEX IF NOT EXISTS steps_run_ts_idx ON steps(run_id, timestamp);
"""


class SQLiteStorage(StorageBackend):
    def __init__(self, db_path: str | None = None) -> None:
        self.db_path = os.path.abspath(db_path or _DEFAULT_DB)
        self._db: aiosqlite.Connection | None = None

    async def initialize(self) -> None:
        await self._conn()

    async def _conn(self) -> aiosqlite.Connection:
        if self._db is None:
            db = await aiosqlite.connect(self.db_path)
            db.row_factory = sqlite3.Row
            await db.executescript(_SCHEMA)
            await db.commit()
            self._db = db
        return self._db

    def _to_dict(self, row: sqlite3.Row | None) -> dict | None:
        if row is None:
            return None
        d: dict = {col: row[col] for col in row.keys()}
        for col in ("input", "output"):
            if d.get(col) is not None:
                try:
                    d[col] = json.loads(d[col])
                except (json.JSONDecodeError, TypeError):
                    pass
        return d

    # ------------------------------------------------------------------
    # Runs
    # ------------------------------------------------------------------

    async def create_run(self, row: dict) -> dict:
        db = await self._conn()
        await db.execute(
            "INSERT INTO runs (id, name, status, created_at, total_tokens, total_cost) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (
                row["id"],
                row["name"],
                row.get("status", "running"),
                row["created_at"],
                row.get("total_tokens"),
                row.get("total_cost"),
            ),
        )
        await db.commit()
        cur = await db.execute("SELECT * FROM runs WHERE id = ?", (row["id"],))
        return self._to_dict(await cur.fetchone())  # type: ignore[return-value]

    async def update_run(self, run_id: str, patch: dict) -> dict:
        db = await self._conn()
        cols = ", ".join(f"{k} = ?" for k in patch)
        await db.execute(f"UPDATE runs SET {cols} WHERE id = ?", [*patch.values(), run_id])
        await db.commit()
        cur = await db.execute("SELECT * FROM runs WHERE id = ?", (run_id,))
        return self._to_dict(await cur.fetchone())  # type: ignore[return-value]

    async def get_run(self, run_id: str) -> dict | None:
        db = await self._conn()
        cur = await db.execute("SELECT * FROM runs WHERE id = ?", (run_id,))
        return self._to_dict(await cur.fetchone())

    async def list_runs(self, limit: int = 50) -> list[dict]:
        db = await self._conn()
        cur = await db.execute(
            "SELECT * FROM runs ORDER BY created_at DESC LIMIT ?", (limit,)
        )
        return [self._to_dict(r) for r in await cur.fetchall()]  # type: ignore[misc]

    async def delete_run(self, run_id: str) -> None:
        db = await self._conn()
        await db.execute("DELETE FROM runs WHERE id = ?", (run_id,))
        await db.commit()

    # ------------------------------------------------------------------
    # Steps
    # ------------------------------------------------------------------

    async def create_step(self, row: dict) -> dict:
        db = await self._conn()
        await db.execute(
            "INSERT INTO steps "
            "(id, run_id, type, status, input, output, latency_ms, token_count, timestamp) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                row["id"],
                row["run_id"],
                row["type"],
                row["status"],
                json.dumps(row["input"]) if row.get("input") is not None else None,
                json.dumps(row["output"]) if row.get("output") is not None else None,
                row.get("latency_ms"),
                row.get("token_count"),
                row["timestamp"],
            ),
        )
        await db.commit()
        cur = await db.execute("SELECT * FROM steps WHERE id = ?", (row["id"],))
        return self._to_dict(await cur.fetchone())  # type: ignore[return-value]

    async def update_step(
        self, step_id: str, patch: dict, run_id: str | None = None
    ) -> dict | None:
        db = await self._conn()
        serialized = {
            k: (json.dumps(v) if k in ("input", "output") and v is not None else v)
            for k, v in patch.items()
        }
        cols = ", ".join(f"{k} = ?" for k in serialized)
        params: list = [*serialized.values(), step_id]
        if run_id:
            await db.execute(
                f"UPDATE steps SET {cols} WHERE id = ? AND run_id = ?", [*params, run_id]
            )
        else:
            await db.execute(f"UPDATE steps SET {cols} WHERE id = ?", params)
        await db.commit()
        cur = await db.execute("SELECT * FROM steps WHERE id = ?", (step_id,))
        return self._to_dict(await cur.fetchone())

    async def list_steps(self, run_id: str) -> list[dict]:
        db = await self._conn()
        cur = await db.execute(
            "SELECT * FROM steps WHERE run_id = ? ORDER BY timestamp", (run_id,)
        )
        return [self._to_dict(r) for r in await cur.fetchall()]  # type: ignore[misc]

    async def list_all_steps(self, run_ids: list[str] | None = None) -> list[dict]:
        if run_ids is not None and not run_ids:
            return []
        db = await self._conn()
        if run_ids:
            placeholders = ",".join("?" * len(run_ids))
            cur = await db.execute(
                f"SELECT * FROM steps WHERE run_id IN ({placeholders}) ORDER BY timestamp",
                tuple(run_ids),
            )
        else:
            cur = await db.execute("SELECT * FROM steps ORDER BY timestamp")
        return [self._to_dict(r) for r in await cur.fetchall()]  # type: ignore[misc]

    # ------------------------------------------------------------------

    async def close(self) -> None:
        if self._db:
            await self._db.close()
            self._db = None
