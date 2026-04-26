"""
Vector store service.
Supports per-user KB collections.
"""

import os
import uuid
from typing import List
from qdrant_client import QdrantClient
from qdrant_client.models import VectorParams, Distance, PointStruct
from dotenv import load_dotenv

load_dotenv()

# Default (legacy) collection
COLLECTION_NAME = "documents"
VECTOR_SIZE = 384  # all-MiniLM-L6-v2 output dim

# Singleton client
_client = None


def get_client() -> QdrantClient:
    """Return the singleton Qdrant client."""
    global _client
    if _client is None:
        _client = QdrantClient(
            url=os.getenv("QDRANT_URL"),
            api_key=os.getenv("QDRANT_API_KEY"),
        )
    return _client


def _ensure_collection(collection_name: str = COLLECTION_NAME):
    """Create the collection if it doesn't exist."""
    client = get_client()
    collections = [c.name for c in client.get_collections().collections]
    if collection_name not in collections:
        client.create_collection(
            collection_name=collection_name,
            vectors_config=VectorParams(
                size=VECTOR_SIZE,
                distance=Distance.COSINE,
            ),
        )


def reset_collection(collection_name: str = COLLECTION_NAME):
    """Delete and recreate the collection (for fresh ingest)."""
    client = get_client()
    collections = [c.name for c in client.get_collections().collections]
    if collection_name in collections:
        client.delete_collection(collection_name=collection_name)
    _ensure_collection(collection_name)


def store_chunks(chunks: List[str], collection_name: str = COLLECTION_NAME):
    """Encode chunks and store them in Qdrant."""
    _ensure_collection(collection_name)
    client = get_client()

    # Lazy import to avoid loading at startup
    from services.embedding import encode_documents
    emd_docs = encode_documents(chunks)

    points = [
        PointStruct(
            id=uuid.uuid4().hex,
            vector=emd_docs[i],
            payload={"text": chunks[i]},
        )
        for i in range(len(chunks))
    ]

    client.upsert(collection_name=collection_name, points=points)
    return len(points)


def store_chunks_for_chat(chunks: List[str], collection_name: str):
    """Store chunks in a chat-specific Qdrant collection."""
    return store_chunks(chunks, collection_name=collection_name)


def query_vectors(query: str, limit: int = 3, collection_name: str = COLLECTION_NAME):
    """Query the vector store."""
    _ensure_collection(collection_name)
    client = get_client()

    from services.embedding import encode_query
    query_vector = encode_query(query)

    results = client.query_points(
        collection_name=collection_name,
        query=query_vector,
        limit=limit,
    )

    return results
