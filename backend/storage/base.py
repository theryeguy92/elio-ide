from __future__ import annotations

from abc import ABC, abstractmethod


class StorageBackend(ABC):
    @abstractmethod
    async def create_run(self, row: dict) -> dict: ...

    @abstractmethod
    async def update_run(self, run_id: str, patch: dict) -> dict: ...

    @abstractmethod
    async def get_run(self, run_id: str) -> dict | None: ...

    @abstractmethod
    async def list_runs(self, limit: int = 50) -> list[dict]: ...

    @abstractmethod
    async def delete_run(self, run_id: str) -> None: ...

    @abstractmethod
    async def create_step(self, row: dict) -> dict: ...

    @abstractmethod
    async def update_step(
        self, step_id: str, patch: dict, run_id: str | None = None
    ) -> dict | None: ...

    @abstractmethod
    async def list_steps(self, run_id: str) -> list[dict]: ...

    @abstractmethod
    async def list_all_steps(self, run_ids: list[str] | None = None) -> list[dict]: ...

    async def close(self) -> None:
        pass
