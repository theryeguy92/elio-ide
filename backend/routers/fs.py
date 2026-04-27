"""File system router — read/write files within the project."""
from __future__ import annotations

import os
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/fs", tags=["fs"])

REPO_PATH = Path(os.getenv("GIT_REPO_PATH", "/home/levey/elio-ide")).resolve()

_SKIP = frozenset({
    ".git", "__pycache__", ".next", "node_modules",
    ".venv", ".mypy_cache", "dist", "build", ".pytest_cache",
})


class FileNode(BaseModel):
    name: str
    path: str          # relative to REPO_PATH, forward-slash separated
    type: Literal["file", "dir"]
    children: list["FileNode"] | None = None


FileNode.model_rebuild()


class FileContent(BaseModel):
    path: str
    content: str


def _resolve(rel_path: str) -> Path:
    """Resolve a repo-relative path, rejecting traversal attempts."""
    full = (REPO_PATH / rel_path).resolve()
    if not str(full).startswith(str(REPO_PATH)):
        raise HTTPException(status_code=403, detail="Access denied")
    return full


def _build_tree(root: Path) -> list[FileNode]:
    nodes: list[FileNode] = []
    try:
        entries = sorted(root.iterdir(), key=lambda e: (e.is_file(), e.name.lower()))
    except PermissionError:
        return []

    for entry in entries:
        if entry.name in _SKIP:
            continue
        if entry.name.startswith(".") and entry.name not in (".env.example",):
            continue

        rel = entry.relative_to(REPO_PATH).as_posix()

        if entry.is_dir():
            nodes.append(FileNode(
                name=entry.name,
                path=rel,
                type="dir",
                children=_build_tree(entry),
            ))
        elif entry.is_file():
            nodes.append(FileNode(name=entry.name, path=rel, type="file"))

    return nodes


@router.get("/tree", response_model=list[FileNode])
async def get_tree(path: str = "") -> list[FileNode]:
    root = _resolve(path) if path else REPO_PATH
    if not root.is_dir():
        raise HTTPException(status_code=404, detail="Directory not found")
    return _build_tree(root)


@router.get("/file", response_model=FileContent)
async def read_file(path: str) -> FileContent:
    full = _resolve(path)
    if not full.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    try:
        content = full.read_text(encoding="utf-8", errors="replace")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    return FileContent(path=path, content=content)


@router.post("/file", response_model=FileContent)
async def write_file(body: FileContent) -> FileContent:
    full = _resolve(body.path)
    full.parent.mkdir(parents=True, exist_ok=True)
    try:
        full.write_text(body.content, encoding="utf-8")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    return body
