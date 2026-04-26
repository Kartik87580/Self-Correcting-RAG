from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class DocumentResponse(BaseModel):
    id: int
    filename: str
    source_type: str
    chunk_count: int
    created_at: datetime

    class Config:
        from_attributes = True
