"""
Embedding service.
Uses Qdrant's built-in FastEmbed (runs on CPU, ~30MB) instead of
sentence-transformers + PyTorch (~400MB).
"""

from qdrant_client import QdrantClient

# Model name compatible with Qdrant FastEmbed
MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"

# Singleton model instance (lazy loaded via qdrant fastembed)
_model = None


def get_embedding_model():
    """Return a lightweight FastEmbed model via qdrant_client."""
    global _model
    if _model is None:
        from fastembed import TextEmbedding
        _model = TextEmbedding(model_name=MODEL_NAME)
    return _model


def encode_documents(texts: list[str]) -> list:
    """Encode a list of text chunks into embeddings."""
    model = get_embedding_model()
    # fastembed returns a generator, convert to list of lists
    embeddings = list(model.embed(texts))
    return [e.tolist() for e in embeddings]


def encode_query(query: str) -> list:
    """Encode a single query for retrieval."""
    model = get_embedding_model()
    embeddings = list(model.query_embed(query))
    return embeddings[0].tolist()
