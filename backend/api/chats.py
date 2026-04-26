"""
Chat API — CRUD for chats, query per chat (uses user's KB), history per chat.
All routes are user-scoped via JWT.
Queries use the user's knowledge base collection (user_{id}_kb).
"""
import os
import sys
import asyncio

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List

from core.database import get_db
from core.auth import decode_token, oauth2_scheme
from models.chat import Chat, ChatMessage
from schemas.chat import ChatCreate, ChatResponse, ChatMessageResponse
from schemas.response_models import QueryResponse
from schemas.request_models import QueryRequest

router = APIRouter()


# ── Helpers ─────────────────────────────────────
def _get_user_id(token: str) -> int:
    payload = decode_token(token)
    user_id = payload.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")
    return user_id


async def _get_user_chat(chat_id: int, user_id: int, db: AsyncSession) -> Chat:
    result = await db.execute(
        select(Chat).filter(Chat.id == chat_id, Chat.user_id == user_id)
    )
    chat = result.scalars().first()
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    return chat


def _kb_collection(user_id: int) -> str:
    """Single Qdrant collection per user."""
    return f"user_{user_id}_kb"


# ─────────────────────────────────────────────────
# CHAT CRUD
# ─────────────────────────────────────────────────

@router.post("", response_model=ChatResponse, status_code=status.HTTP_201_CREATED)
async def create_chat(
    body: ChatCreate,
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
):
    user_id = _get_user_id(token)
    chat = Chat(user_id=user_id, title=body.title)
    db.add(chat)
    await db.commit()
    await db.refresh(chat)
    return ChatResponse.model_validate(chat)


@router.get("", response_model=List[ChatResponse])
async def list_chats(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
):
    user_id = _get_user_id(token)
    result = await db.execute(
        select(Chat).filter(Chat.user_id == user_id).order_by(Chat.created_at.desc())
    )
    return [ChatResponse.model_validate(c) for c in result.scalars().all()]


@router.delete("/{chat_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_chat(
    chat_id: int,
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
):
    user_id = _get_user_id(token)
    await _get_user_chat(chat_id, user_id, db)
    # Only delete chat + messages from DB, NOT from Qdrant (KB is shared)
    await db.execute(
        select(Chat).filter(Chat.id == chat_id, Chat.user_id == user_id)
    )
    chat = (await db.execute(
        select(Chat).filter(Chat.id == chat_id)
    )).scalars().first()
    await db.delete(chat)
    await db.commit()


# ─────────────────────────────────────────────────
# QUERY — uses user's KB collection
# ─────────────────────────────────────────────────

@router.post("/{chat_id}/query", response_model=QueryResponse)
async def query_chat(
    chat_id: int,
    request: QueryRequest,
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
):
    user_id = _get_user_id(token)
    await _get_user_chat(chat_id, user_id, db)

    if not request.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty.")

    # Query user's single KB collection
    col = _kb_collection(user_id)

    try:
        from graph.crag_graph import run_crag_pipeline
        result = run_crag_pipeline(request.question, collection_name=col)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Pipeline error: {str(e)}")

    answer = result.get("answer", "")
    verdict = result.get("verdict", "")
    reason = result.get("reason", "")
    good_docs = result.get("good_docs", [])
    kept_strips = result.get("kept_strips", [])

    # Save message to DB
    msg = ChatMessage(
        chat_id=chat_id,
        question=request.question,
        answer=answer,
        verdict=verdict,
        reason=reason,
    )
    db.add(msg)
    await db.commit()

    return QueryResponse(
        answer=answer,
        verdict=verdict,
        reason=reason,
        web_query=result.get("web_query", ""),
        num_good_docs=len(good_docs) if good_docs else 0,
        num_kept_strips=len(kept_strips) if kept_strips else 0,
    )


# ─────────────────────────────────────────────────
# HISTORY for a specific chat
# ─────────────────────────────────────────────────

@router.get("/{chat_id}/history", response_model=List[ChatMessageResponse])
async def chat_history(
    chat_id: int,
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
):
    user_id = _get_user_id(token)
    await _get_user_chat(chat_id, user_id, db)

    result = await db.execute(
        select(ChatMessage)
        .filter(ChatMessage.chat_id == chat_id)
        .order_by(ChatMessage.created_at.asc())
    )
    return [ChatMessageResponse.model_validate(m) for m in result.scalars().all()]
