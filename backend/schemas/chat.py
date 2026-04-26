from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class ChatCreate(BaseModel):
    title: Optional[str] = "New Chat"


class ChatResponse(BaseModel):
    id: int
    title: str
    created_at: datetime

    class Config:
        from_attributes = True


class ChatMessageResponse(BaseModel):
    id: int
    question: str
    answer: str
    verdict: Optional[str] = None
    reason: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
