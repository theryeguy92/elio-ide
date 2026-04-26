from __future__ import annotations

import asyncio
import os

import git
from anthropic import AsyncAnthropic
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/git", tags=["git"])

_anthropic: AsyncAnthropic | None = None


def _client() -> AsyncAnthropic:
    global _anthropic
    if _anthropic is None:
        _anthropic = AsyncAnthropic()
    return _anthropic


def _repo() -> git.Repo:
    path = os.getenv("GIT_REPO_PATH", ".")
    try:
        return git.Repo(path, search_parent_directories=True)
    except git.InvalidGitRepositoryError as e:
        raise HTTPException(status_code=500, detail=f"No git repository found at {path}") from e


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------


class FileStatus(BaseModel):
    path: str
    status: str  # M, A, D, R, ? etc.
    staged: bool
    unstaged: bool


class GitStatusResponse(BaseModel):
    branch: str
    ahead: int
    behind: int
    files: list[FileStatus]


class CommitEntry(BaseModel):
    hash: str
    short_hash: str
    message: str
    author: str
    date: str


class BranchEntry(BaseModel):
    name: str
    current: bool
    remote: bool


class StageRequest(BaseModel):
    paths: list[str]


class CommitRequest(BaseModel):
    message: str


class PushResponse(BaseModel):
    pushed: bool
    output: str


class CreateBranchRequest(BaseModel):
    name: str
    checkout: bool = True


class CheckoutRequest(BaseModel):
    branch: str


class SuggestMessageResponse(BaseModel):
    message: str


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _parse_status(repo: git.Repo) -> list[FileStatus]:
    try:
        output = repo.git.status("--porcelain")
    except git.GitCommandError:
        return []

    files: dict[str, FileStatus] = {}
    for line in output.splitlines():
        if not line:
            continue
        x, y = line[0], line[1]
        path = line[3:]
        if " -> " in path:
            path = path.split(" -> ")[-1]

        entry = files.get(path)
        if entry is None:
            entry = FileStatus(path=path, status="?", staged=False, unstaged=False)
            files[path] = entry

        if x not in (" ", "?"):
            entry.staged = True
            entry.status = x
        if y not in (" ", "?"):
            entry.unstaged = True
            if not entry.staged:
                entry.status = y
        if x == "?" and y == "?":
            entry.unstaged = True
            entry.status = "?"

    return list(files.values())


def _ahead_behind(repo: git.Repo) -> tuple[int, int]:
    try:
        tracking = repo.active_branch.tracking_branch()
        if tracking is None:
            return 0, 0
        ahead = len(list(repo.iter_commits(f"{tracking}..HEAD")))
        behind = len(list(repo.iter_commits(f"HEAD..{tracking}")))
        return ahead, behind
    except Exception:
        return 0, 0


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("/status", response_model=GitStatusResponse)
async def git_status() -> GitStatusResponse:
    def _run() -> GitStatusResponse:
        repo = _repo()
        try:
            branch = repo.active_branch.name
        except TypeError:
            branch = "HEAD (detached)"
        ahead, behind = _ahead_behind(repo)
        files = _parse_status(repo)
        return GitStatusResponse(branch=branch, ahead=ahead, behind=behind, files=files)

    return await asyncio.to_thread(_run)


@router.get("/log", response_model=list[CommitEntry])
async def git_log(limit: int = 20) -> list[CommitEntry]:
    def _run() -> list[CommitEntry]:
        repo = _repo()
        try:
            commits = list(repo.iter_commits("HEAD", max_count=limit))
        except git.BadName:
            return []
        return [
            CommitEntry(
                hash=c.hexsha,
                short_hash=c.hexsha[:7],
                message=c.message.strip().splitlines()[0],
                author=c.author.name or "",
                date=c.committed_datetime.isoformat(),
            )
            for c in commits
        ]

    return await asyncio.to_thread(_run)


@router.post("/stage")
async def git_stage(body: StageRequest) -> dict:
    def _run() -> dict:
        repo = _repo()
        repo.index.add(body.paths)
        return {"staged": body.paths}

    return await asyncio.to_thread(_run)


@router.post("/unstage")
async def git_unstage(body: StageRequest) -> dict:
    def _run() -> dict:
        repo = _repo()
        try:
            repo.index.reset(paths=body.paths)
        except (git.BadName, git.GitCommandError):
            repo.git.rm("--cached", "-f", *body.paths)
        return {"unstaged": body.paths}

    return await asyncio.to_thread(_run)


@router.post("/commit", response_model=CommitEntry)
async def git_commit(body: CommitRequest) -> CommitEntry:
    def _run() -> CommitEntry:
        repo = _repo()
        commit = repo.index.commit(body.message)
        return CommitEntry(
            hash=commit.hexsha,
            short_hash=commit.hexsha[:7],
            message=commit.message.strip().splitlines()[0],
            author=commit.author.name or "",
            date=commit.committed_datetime.isoformat(),
        )

    return await asyncio.to_thread(_run)


@router.post("/push", response_model=PushResponse)
async def git_push() -> PushResponse:
    def _run() -> PushResponse:
        repo = _repo()
        try:
            branch = repo.active_branch
            remote = repo.remote("origin")
            push_infos = remote.push(refspec=f"{branch.name}:{branch.name}", set_upstream=True)
            summary = push_infos[0].summary if push_infos else "pushed"
            return PushResponse(pushed=True, output=summary.strip())
        except git.GitCommandError as e:
            raise HTTPException(status_code=400, detail=str(e)) from e

    return await asyncio.to_thread(_run)


@router.get("/branches", response_model=list[BranchEntry])
async def git_branches() -> list[BranchEntry]:
    def _run() -> list[BranchEntry]:
        repo = _repo()
        try:
            current = repo.active_branch.name
        except TypeError:
            current = ""
        branches: list[BranchEntry] = []
        for b in repo.branches:  # type: ignore[attr-defined]
            branches.append(BranchEntry(name=b.name, current=b.name == current, remote=False))
        for r in repo.remotes:
            for rb in r.refs:
                branches.append(BranchEntry(name=rb.name, current=False, remote=True))
        return branches

    return await asyncio.to_thread(_run)


@router.post("/branches", response_model=BranchEntry)
async def git_create_branch(body: CreateBranchRequest) -> BranchEntry:
    def _run() -> BranchEntry:
        repo = _repo()
        new_branch = repo.create_head(body.name)
        if body.checkout:
            new_branch.checkout()
        return BranchEntry(name=body.name, current=body.checkout, remote=False)

    return await asyncio.to_thread(_run)


@router.post("/checkout", response_model=BranchEntry)
async def git_checkout(body: CheckoutRequest) -> BranchEntry:
    def _run() -> BranchEntry:
        repo = _repo()
        repo.git.checkout(body.branch)
        return BranchEntry(name=body.branch, current=True, remote=False)

    return await asyncio.to_thread(_run)


@router.post("/suggest-message", response_model=SuggestMessageResponse)
async def suggest_message() -> SuggestMessageResponse:
    def _get_diff() -> str:
        repo = _repo()
        diff = ""
        try:
            diff = repo.git.diff("--cached")
        except Exception:
            pass
        if not diff:
            try:
                diff = repo.git.diff()
            except Exception:
                pass
        return diff[:4000]

    diff = await asyncio.to_thread(_get_diff)

    if not diff:
        return SuggestMessageResponse(message="chore: update files")

    resp = await _client().messages.create(
        model="claude-sonnet-4-6",
        max_tokens=100,
        messages=[
            {
                "role": "user",
                "content": (
                    "Write a single concise git commit message (imperative mood, ≤72 chars, "
                    "no period at end) for this diff. Reply with only the message text, nothing else.\n\n"
                    f"```diff\n{diff}\n```"
                ),
            }
        ],
    )

    text = resp.content[0].text.strip().strip('"').strip("'")
    return SuggestMessageResponse(message=text)
