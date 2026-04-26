"""
CRAG Pipeline FastAPI Backend
Main entry point — run with: uvicorn main:app --reload
"""

import os
import sys
import asyncio
from contextlib import asynccontextmanager

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.ingest import router as ingest_router
from api.query import router as query_router
from api.graph import router as graph_router
from api.auth import router as auth_router
from api.chats import router as chats_router
from api.documents import router as documents_router

from core.database import engine
from models import User, Chat, ChatMessage, Document  # noqa: F401 — registers all tables
from core.database import Base


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create tables if they don't exist, using async engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield


app = FastAPI(
    title="CRAG Pipeline API",
    description="Corrective RAG pipeline backend for document Q&A",
    version="2.0.0",
    lifespan=lifespan,
    redirect_slashes=False,
)

# CORS — configurable via env var for production
cors_origins = os.getenv("CORS_ORIGINS", "*")
origins = [o.strip() for o in cors_origins.split(",")] if cors_origins != "*" else ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(auth_router, prefix="/auth", tags=["Auth"])
app.include_router(documents_router, prefix="/documents", tags=["Documents"])
app.include_router(chats_router, prefix="/chats", tags=["Chats"])
app.include_router(ingest_router, tags=["Ingest"])
app.include_router(query_router, tags=["Query"])
app.include_router(graph_router, tags=["Graph"])


@app.get("/health")
def health():
    """Returns server status."""
    return {"status": "ok"}
