"""Agent architecture manifest — elio.agents.yaml at the project root.

Developers declare their agents/tools/memory; the stakeholder graph merges
this declared architecture with observed trace data. See elio.agents.yaml
in this repo for a documented example.
"""
from __future__ import annotations

from pathlib import Path
from typing import Any

import yaml

from config import settings

FILENAME = "elio.agents.yaml"


def manifest_path() -> Path:
    return Path(settings.get("project_path", ".")) / FILENAME


def load_manifest() -> dict[str, Any] | None:
    """Parse the manifest, or None if absent/invalid (logged, never raised)."""
    import logging

    path = manifest_path()
    if not path.is_file():
        return None
    try:
        data = yaml.safe_load(path.read_text(encoding="utf-8"))
    except yaml.YAMLError as exc:
        logging.getLogger("elio").warning("Invalid %s: %s", FILENAME, exc)
        return None
    return data if isinstance(data, dict) else None


def manifest_description(manifest: dict[str, Any], node_id: str) -> str | None:
    """Declared description for a node id like 'tool_search_ecfr', if any."""
    prefix, _, slug = node_id.partition("_")
    section = {"agent": "agents", "tool": "tools", "memory": "memory"}.get(prefix)
    if not section:
        return None
    for entry in manifest.get(section) or []:
        if not isinstance(entry, dict):
            continue
        from routers.stakeholder import _slugify  # same slug rules as traces

        entry_slug = _slugify(str(entry.get("id") or entry.get("label") or ""))
        if entry_slug == slug and entry.get("description"):
            return str(entry["description"])
    return None
