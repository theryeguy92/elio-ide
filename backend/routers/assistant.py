"""Assistant router — helper agent for vault setup and README drafting.

Single-shot Claude calls (same pattern as git.py's suggest-message). The
client owns conversation history and resends it each turn, so the backend
stays stateless.
"""
from __future__ import annotations

import json
import re
from typing import Literal

from anthropic import AsyncAnthropic
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from routers.fs import REPO_PATH, _build_tree as _project_tree
from routers.vault import VAULT_PATH, _build_tree as _vault_tree

router = APIRouter(prefix="/assistant", tags=["assistant"])

_anthropic: AsyncAnthropic | None = None
_MODEL = "claude-sonnet-4-6"


def _client() -> AsyncAnthropic:
    global _anthropic
    if _anthropic is None:
        _anthropic = AsyncAnthropic()
    return _anthropic


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    mode: Literal["vault-setup", "readme"]
    message: str
    history: list[ChatMessage] = []


class ProposedFile(BaseModel):
    path: str
    content: str


class ChatResponse(BaseModel):
    reply: str
    files: list[ProposedFile] = []


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_JSON_FENCE = re.compile(r"```json\s*(\{.*?\})\s*```", re.DOTALL)


def _extract_files(text: str) -> tuple[str, list[ProposedFile]]:
    """Pull the last ```json {"files": [...]} fence out of a Claude reply."""
    files: list[ProposedFile] = []
    matches = list(_JSON_FENCE.finditer(text))
    if matches:
        match = matches[-1]
        try:
            data = json.loads(match.group(1))
            for f in data.get("files", []):
                path, content = f.get("path", ""), f.get("content")
                if (
                    isinstance(path, str)
                    and isinstance(content, str)
                    and path
                    and not path.startswith("/")
                    and ".." not in path.split("/")
                ):
                    files.append(ProposedFile(path=path, content=content))
        except (json.JSONDecodeError, AttributeError):
            pass
        text = (text[: match.start()] + text[match.end():]).strip()
    return text, files


def _flatten(nodes: list, limit: int = 200) -> list[str]:
    paths: list[str] = []
    stack = list(nodes)
    while stack and len(paths) < limit:
        node = stack.pop(0)
        paths.append(node.path)
        if node.children:
            stack.extend(node.children)
    return paths


def _project_context() -> str:
    parts: list[str] = []
    readme = REPO_PATH / "README.md"
    if readme.is_file():
        parts.append(f"## Project README.md\n\n{readme.read_text(encoding='utf-8', errors='replace')[:4000]}")
    else:
        parts.append("## Project README.md\n\n(none exists)")
    try:
        parts.append("## Project file tree\n\n" + "\n".join(_flatten(_project_tree(REPO_PATH))))
    except Exception:
        pass
    return "\n\n".join(parts)


def _vault_context() -> str:
    if not VAULT_PATH.is_dir():
        return "## Existing vault notes\n\n(vault not found — it will be created from scratch)"
    return "## Existing vault notes\n\n" + ("\n".join(_flatten(_vault_tree(VAULT_PATH))) or "(empty)")


_SYSTEM = {
    "vault-setup": (
        "You are a Zettelkasten/Obsidian assistant inside Elio IDE. Help the user set up or "
        "organize their Obsidian vault based on their project. Conventions: atomic notes (one "
        "idea per note), Maps of Content (MOCs) as index notes, [[wikilinks]] between notes, "
        "minimal folder structure. When you are ready to propose concrete notes, output exactly "
        'one ```json fence containing {"files": [{"path": "relative/note.md", "content": "..."}]} '
        "with vault-relative paths, then briefly explain the proposal outside the fence. "
        "If you need more information first, ask short clarifying questions and do not output "
        "the json fence yet."
    ),
    "readme": (
        "You are a technical writing assistant inside Elio IDE. Help the user write a "
        "professional README.md for their project: what it is, features, architecture, "
        "quick start, configuration, development. When ready, output exactly one ```json "
        'fence containing {"files": [{"path": "README.md", "content": "..."}]} with the full '
        "README, then briefly summarize your choices outside the fence. If you need more "
        "information first, ask short clarifying questions and do not output the json fence yet."
    ),
}


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------


@router.post("/chat", response_model=ChatResponse)
async def chat(body: ChatRequest) -> ChatResponse:
    context = _project_context() + "\n\n" + _vault_context()

    messages = [
        {"role": m.role, "content": m.content} for m in body.history[-10:]
    ]
    messages.append({
        "role": "user",
        "content": f"{context}\n\n---\n\nUser: {body.message}",
    })

    try:
        resp = await _client().messages.create(
            model=_MODEL,
            max_tokens=4096,
            system=_SYSTEM[body.mode],
            messages=messages,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Claude call failed (is ANTHROPIC_API_KEY set?): {exc}",
        ) from exc

    reply, files = _extract_files(resp.content[0].text)
    return ChatResponse(reply=reply, files=files)
