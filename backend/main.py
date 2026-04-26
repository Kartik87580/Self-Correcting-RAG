"""
CRAG Pipeline FastAPI Backend
Main entry point — run with: uvicorn main:app --reload
"""

import os
import sys
import asyncio
import logging
from contextlib import asynccontextmanager

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# NOTE: Router imports are lightweight — heavy ML models inside them
# use lazy imports so they don't load until first request.
from api.ingest import router as ingest_router
from api.query import router as query_router
from api.graph import router as graph_router
from api.auth import router as auth_router
from api.chats import router as chats_router
from api.documents import router as documents_router

from core.database import engine, Base
from models import User, Chat, ChatMessage, Document  # noqa: F401

logger = logging.getLogger("uvicorn.error")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create tables with a timeout (Neon cold starts can be slow)
    try:
        async with asyncio.timeout(30):
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
        logger.info("✅ Database tables ready")
    except Exception as e:
        logger.warning(f"⚠️ DB table creation issue (non-fatal): {e}")
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