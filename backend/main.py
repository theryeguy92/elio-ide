from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from routers.git import router as git_router
from routers.gpu import router as gpu_router
from routers.stakeholder import router as stakeholder_router
from routers.trace import router as trace_router

app = FastAPI(title="Elio IDE API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(gpu_router)
app.include_router(trace_router)
app.include_router(stakeholder_router)
app.include_router(git_router)


class HealthResponse(BaseModel):
    status: str
    version: str


@app.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    return HealthResponse(status="ok", version="0.1.0")
