import os

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/gpu", tags=["gpu"])

RUNPOD_GQL = "https://api.runpod.io/graphql"


# ---------------------------------------------------------------------------
# Dependency
# ---------------------------------------------------------------------------


def runpod_key() -> str:
    key = os.getenv("RUNPOD_API_KEY")
    if not key:
        raise HTTPException(status_code=500, detail="RUNPOD_API_KEY is not configured")
    return key


# ---------------------------------------------------------------------------
# Shared GraphQL helper
# ---------------------------------------------------------------------------


async def gql(query: str, variables: dict, api_key: str) -> dict:
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            RUNPOD_GQL,
            json={"query": query, "variables": variables},
            headers={"Authorization": f"Bearer {api_key}"},
        )
        resp.raise_for_status()
        body = resp.json()
        if "errors" in body:
            raise HTTPException(status_code=502, detail=body["errors"][0]["message"])
        return body["data"]


# ---------------------------------------------------------------------------
# Response models
# ---------------------------------------------------------------------------


class GPUProvider(BaseModel):
    id: str
    name: str
    memory_gb: int
    price_per_hr: float
    available: bool


class LaunchRequest(BaseModel):
    gpu_type_id: str
    image: str = "runpod/pytorch:2.1.0-py3.10-cuda11.8.0-devel-ubuntu22.04"
    disk_gb: int = 20


class SessionResponse(BaseModel):
    id: str
    status: str
    gpu_type: str
    cost_per_hr: float
    uptime_seconds: int | None = None
    accrued_cost: float | None = None


# ---------------------------------------------------------------------------
# GET /gpu/providers
# ---------------------------------------------------------------------------


@router.get("/providers", response_model=list[GPUProvider])
async def list_providers(api_key: str = Depends(runpod_key)) -> list[GPUProvider]:
    query = """
    query {
      gpuTypes {
        id
        displayName
        memoryInGb
        secureCloud
        communityCloud
        lowestPrice {
          minimumBidPrice
          uninterruptablePrice
        }
      }
    }
    """
    data = await gql(query, {}, api_key)

    providers: list[GPUProvider] = []
    for g in data.get("gpuTypes", []):
        lowest = g.get("lowestPrice") or {}
        price = lowest.get("uninterruptablePrice") or lowest.get("minimumBidPrice") or 0.0
        providers.append(
            GPUProvider(
                id=g["id"],
                name=g["displayName"],
                memory_gb=g.get("memoryInGb") or 0,
                price_per_hr=float(price),
                available=bool(g.get("secureCloud") or g.get("communityCloud")),
            )
        )

    return sorted(providers, key=lambda p: p.price_per_hr)


# ---------------------------------------------------------------------------
# POST /gpu/sessions
# ---------------------------------------------------------------------------


@router.post("/sessions", response_model=SessionResponse, status_code=201)
async def launch_session(
    body: LaunchRequest,
    api_key: str = Depends(runpod_key),
) -> SessionResponse:
    query = """
    mutation Launch($input: PodFindAndDeployOnDemandInput!) {
      podFindAndDeployOnDemand(input: $input) {
        id
        desiredStatus
        costPerHr
        machine { gpuDisplayName }
      }
    }
    """
    variables = {
        "input": {
            "gpuTypeId": body.gpu_type_id,
            "imageName": body.image,
            "gpuCount": 1,
            "volumeInGb": body.disk_gb,
            "containerDiskInGb": body.disk_gb,
            "minVcpuCount": 2,
            "minMemoryInGb": 15,
        }
    }
    data = await gql(query, variables, api_key)
    pod = data["podFindAndDeployOnDemand"]

    return SessionResponse(
        id=pod["id"],
        status=(pod.get("desiredStatus") or "pending").lower(),
        gpu_type=(pod.get("machine") or {}).get("gpuDisplayName") or body.gpu_type_id,
        cost_per_hr=float(pod.get("costPerHr") or 0.0),
    )


# ---------------------------------------------------------------------------
# GET /gpu/sessions/{session_id}
# ---------------------------------------------------------------------------


@router.get("/sessions/{session_id}", response_model=SessionResponse)
async def get_session(
    session_id: str,
    api_key: str = Depends(runpod_key),
) -> SessionResponse:
    query = """
    query Status($input: PodFilter!) {
      pod(input: $input) {
        id
        desiredStatus
        costPerHr
        machine { gpuDisplayName }
        runtime { uptimeInSeconds }
      }
    }
    """
    data = await gql(query, {"input": {"podId": session_id}}, api_key)
    pod = data.get("pod")
    if not pod:
        raise HTTPException(status_code=404, detail="Session not found")

    cost = float(pod.get("costPerHr") or 0.0)
    runtime = pod.get("runtime") or {}
    uptime: int | None = runtime.get("uptimeInSeconds")
    accrued = round(uptime / 3600 * cost, 6) if uptime and cost else None

    return SessionResponse(
        id=pod["id"],
        status=(pod.get("desiredStatus") or "unknown").lower(),
        gpu_type=(pod.get("machine") or {}).get("gpuDisplayName") or "",
        cost_per_hr=cost,
        uptime_seconds=uptime,
        accrued_cost=accrued,
    )


# ---------------------------------------------------------------------------
# DELETE /gpu/sessions/{session_id}
# ---------------------------------------------------------------------------


@router.delete("/sessions/{session_id}", status_code=204)
async def terminate_session(
    session_id: str,
    api_key: str = Depends(runpod_key),
) -> None:
    query = """
    mutation Terminate($input: PodTerminateInput!) {
      podTerminate(input: $input)
    }
    """
    await gql(query, {"input": {"podId": session_id}}, api_key)
