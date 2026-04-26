"""
Documents API — upload, list, delete docs in user's knowledge base.
All docs go into a single Qdrant collection per user: user_{id}_kb
"""
import os
import tempfile
import sys
import asyncio

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import Optional, List

from core.database import get_db
from core.auth import decode_token, oauth2_scheme
from models.document import Document
from schemas.document import DocumentResponse
from schemas.response_models import IngestResponse

router = APIRouter()


def _get_user_id(token: str) -> int:
    payload = decode_token(token)
    user_id = payload.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")
    return user_id


def _kb_collection(user_id: int) -> str:
    """Single Qdrant collection per user."""
    return f"user_{user_id}_kb"


def _sync_extract_webpage(url: str) -> str:
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
    from document_ingestion.extractors import extract_webpage
    return asyncio.run(extract_webpage(url))


# ── Upload & ingest a document ──────────────────
@router.post("", response_model=IngestResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
    file: Optional[UploadFile] = File(None),
    url: Optional[str] = Form(None),
    source_type: Optional[str] = Form(None),
):
    user_id = _get_user_id(token)

    if file is None and url is None:
        raise HTTPException(status_code=400, detail="Provide either a file or a URL.")

    # Determine filename for DB record
    filename = file.filename if file else url

    # Step 1: Extract raw text
    try:
        if file is not None:
            suffix = os.path.splitext(file.filename)[1]
            with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
                content = await file.read()
                tmp.write(content)
                tmp_path = tmp.name

            try:
                if source_type == 'audio':
                    from utils.file_loader import extract_text_from_audio
                    raw_text = extract_text_from_audio(tmp_path)
                elif source_type == 'simple_pdf':
                    from utils.file_loader import extract_text_from_pdf
                    raw_text = extract_text_from_pdf(tmp_path)
                elif source_type == 'ocr_pdf':
                    from utils.file_loader import extract_text_from_ocr_pdf
                    raw_text = extract_text_from_ocr_pdf(tmp_path)
                elif source_type == 'txt':
                    from utils.file_loader import extract_text_from_txt
                    raw_text = extract_text_from_txt(tmp_path)
                else:
                    from utils.file_loader import extract_text_from_file
                    raw_text = extract_text_from_file(tmp_path, file.filename)
            finally:
                os.unlink(tmp_path)
        else:
            if source_type == 'youtube':
                from utils.web_loader import extract_text_from_youtube
                raw_text = extract_text_from_youtube(url)
            elif source_type == 'website':
                raw_text = await asyncio.to_thread(_sync_extract_webpage, url)
            else:
                from utils.web_loader import extract_text_from_url
                raw_text = await extract_text_from_url(url)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to extract text: {str(e)}")

    if not raw_text or len(raw_text.strip()) < 10:
        raise HTTPException(status_code=422, detail="Could not extract meaningful text.")

    # Step 2: Preprocess
    from services.preprocessing import process_text_to_markdown
    clean_text = process_text_to_markdown(raw_text)

    # Step 3: Chunk
    from services.chunking import chunk_text
    chunks = chunk_text(clean_text)
    if not chunks:
        raise HTTPException(status_code=422, detail="No chunks generated.")

    # Step 4: Store in user's KB collection
    from services.vectorstore import store_chunks
    col = _kb_collection(user_id)
    num_stored = store_chunks(chunks, collection_name=col)

    # Step 5: Save document record in DB
    doc = Document(
        user_id=user_id,
        filename=filename,
        source_type=source_type or "unknown",
        chunk_count=num_stored,
    )
    db.add(doc)
    await db.commit()

    return IngestResponse(
        status="success",
        message=f"Ingested '{filename}' — {num_stored} chunks stored.",
        num_chunks=num_stored,
    )


# ── List user's documents ───────────────────────
@router.get("", response_model=List[DocumentResponse])
async def list_documents(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
):
    user_id = _get_user_id(token)
    result = await db.execute(
        select(Document).filter(Document.user_id == user_id).order_by(Document.created_at.desc())
    )
    return [DocumentResponse.model_validate(d) for d in result.scalars().all()]


# ── Delete a document ───────────────────────────
@router.delete("/{doc_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    doc_id: int,
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
):
    user_id = _get_user_id(token)
    result = await db.execute(
        select(Document).filter(Document.id == doc_id, Document.user_id == user_id)
    )
    doc = result.scalars().first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    await db.delete(doc)
    await db.commit()
