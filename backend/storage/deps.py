from __future__ import annotations

from .base import StorageBackend

_storage: StorageBackend | None = None


def set_storage(backend: StorageBackend) -> None:
    global _storage
    _storage = backend


def get_storage() -> StorageBackend:
    if _storage is None:
        raise RuntimeError("Storage backend not initialized")
    return _storage
