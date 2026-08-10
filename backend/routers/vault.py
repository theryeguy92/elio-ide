"""Vault router — browse/edit/search an Obsidian vault (markdown only)."""
from __future__ import annotations

import os
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/vault", tags=["vault"])

VAULT_PATH = Path(
    os.getenv("VAULT_PATH", str(Path.home() / "vaults" / "RegMetAI"))
).resolve()

_SKIP_DIRS = frozenset({".obsidian", ".trash", ".git"})


class VaultNode(BaseModel):
    name: str
    path: str          # relative to VAULT_PATH, forward-slash separated
    type: Literal["file", "dir"]
    children: list["VaultNode"] | None = None


VaultNode.model_rebuild()


class NoteContent(BaseModel):
    path: str
    content: str


class SearchHit(BaseModel):
    path: str
    snippet: str


def _vault_root() -> Path:
    if not VAULT_PATH.is_dir():
        raise HTTPException(
            status_code=404,
            detail=f"Vault not found at {VAULT_PATH}. Set VAULT_PATH in backend/.env",
        )
    return VAULT_PATH


def _resolve(rel_path: str) -> Path:
    """Resolve a vault-relative path, rejecting traversal attempts."""
    root = _vault_root()
    full = (root / rel_path).resolve()
    if not str(full).startswith(str(root)):
        raise HTTPException(status_code=403, detail="Access denied")
    return full


def _build_tree(root: Path) -> list[VaultNode]:
    """Markdown files + dirs that contain them; empty dirs pruned."""
    nodes: list[VaultNode] = []
    try:
        entries = sorted(root.iterdir(), key=lambda e: (e.is_file(), e.name.lower()))
    except PermissionError:
        return []

    for entry in entries:
        if entry.name.startswith(".") or entry.name in _SKIP_DIRS:
            continue

        rel = entry.relative_to(VAULT_PATH).as_posix()

        if entry.is_dir():
            children = _build_tree(entry)
            if children:
                nodes.append(VaultNode(
                    name=entry.name, path=rel, type="dir", children=children,
                ))
        elif entry.is_file() and entry.suffix.lower() == ".md":
            nodes.append(VaultNode(name=entry.name, path=rel, type="file"))

    return nodes


@router.get("/tree", response_model=list[VaultNode])
async def get_tree() -> list[VaultNode]:
    return _build_tree(_vault_root())


@router.get("/note", response_model=NoteContent)
async def read_note(path: str) -> NoteContent:
    full = _resolve(path)
    if not full.is_file():
        raise HTTPException(status_code=404, detail="Note not found")
    try:
        content = full.read_text(encoding="utf-8", errors="replace")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    return NoteContent(path=path, content=content)


@router.post("/note", response_model=NoteContent)
async def write_note(body: NoteContent) -> NoteContent:
    full = _resolve(body.path)
    full.parent.mkdir(parents=True, exist_ok=True)
    try:
        full.write_text(body.content, encoding="utf-8")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    return body


@router.get("/resolve", response_model=NoteContent)
async def resolve_note(name: str) -> NoteContent:
    """Find a note by name (case-insensitive, [[ ]] and .md tolerated)."""
    root = _vault_root()
    target = name.strip().strip("[]").removesuffix(".md").lower()
    if not target or "/" in target or ".." in target:
        raise HTTPException(status_code=400, detail="Invalid note name")

    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if not d.startswith(".") and d not in _SKIP_DIRS]
        for filename in sorted(filenames):
            if filename.lower().removesuffix(".md") == target and filename.lower().endswith(".md"):
                full = Path(dirpath) / filename
                try:
                    content = full.read_text(encoding="utf-8", errors="replace")
                except Exception as exc:
                    raise HTTPException(status_code=500, detail=str(exc)) from exc
                return NoteContent(path=full.relative_to(root).as_posix(), content=content)

    raise HTTPException(status_code=404, detail=f"No note named '{target}'")


@router.get("/search", response_model=list[SearchHit])
async def search_notes(q: str, limit: int = 50) -> list[SearchHit]:
    """Case-insensitive substring match over note filenames and content."""
    root = _vault_root()
    query = q.strip().lower()
    if not query:
        return []

    hits: list[SearchHit] = []
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if not d.startswith(".") and d not in _SKIP_DIRS]
        for filename in sorted(filenames):
            if not filename.lower().endswith(".md"):
                continue
            full = Path(dirpath) / filename
            rel = full.relative_to(root).as_posix()

            if query in filename.lower():
                hits.append(SearchHit(path=rel, snippet=filename))
                continue

            try:
                text = full.read_text(encoding="utf-8", errors="replace")
            except Exception:
                continue
            idx = text.lower().find(query)
            if idx >= 0:
                start = max(0, idx - 40)
                snippet = text[start:idx + 60].replace("\n", " ").strip()
                hits.append(SearchHit(path=rel, snippet=f"…{snippet}…"))

            if len(hits) >= limit:
                return hits

    return hits[:limit]
