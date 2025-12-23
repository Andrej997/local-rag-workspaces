from sentence_transformers import CrossEncoder
import torch
from utils.logger import get_logger

logger = get_logger(__name__)

# Lazy-load model to avoid import-time errors
_model = None
_model_load_error = None


def _get_reranker_model():
    """
    Lazy-load the reranker model.
    Returns the model instance or None if loading failed.
    """
    global _model, _model_load_error

    # Return cached model if already loaded
    if _model is not None:
        return _model

    # If previous load attempt failed, don't retry
    if _model_load_error is not None:
        return None

    try:
        # Use CPU by default, or CUDA if available
        device = 'cuda' if torch.cuda.is_available() else 'cpu'
        logger.info(f"Loading Reranker model on {device}...")

        _model = CrossEncoder('cross-encoder/ms-marco-MiniLM-L-6-v2', max_length=512, device=device)
        logger.info("Reranker model loaded successfully.")
        return _model

    except Exception as e:
        _model_load_error = str(e)
        logger.error(f"Failed to load reranker model: {e}")
        logger.warning("Reranking will be disabled. Documents will be returned without reranking.")
        return None


def rerank_documents(query: str, documents: list, top_k: int = 5):
    """
    Rerank a list of documents based on relevance to the query.
    Falls back to returning documents as-is if model loading fails.

    Args:
        query: The search query
        documents: list of dicts, must contain 'content' key
        top_k: Number of top documents to return

    Returns:
        Reranked list of documents, or original list if reranking fails
    """
    if not documents:
        return []

    # Try to get the model
    model = _get_reranker_model()

    # If model loading failed, return documents without reranking
    if model is None:
        logger.debug("Reranker model not available, returning documents without reranking")
        return documents[:top_k]

    try:
        # Remove duplicates based on content to avoid scoring same chunk twice
        unique_docs = []
        seen = set()
        for doc in documents:
            # Use a hash of content or first 100 chars as signature
            sig = doc.get('content', '')[:100]
            if sig not in seen:
                seen.add(sig)
                unique_docs.append(doc)

        docs_to_rank = unique_docs

        # Create pairs: [[query, doc1], [query, doc2], ...]
        pairs = [[query, doc['content']] for doc in docs_to_rank]

        if not pairs:
            return []

        # Predict scores
        scores = model.predict(pairs)

        # Attach scores
        for i, doc in enumerate(docs_to_rank):
            doc['rerank_score'] = float(scores[i])

        # Sort by rerank score descending
        sorted_docs = sorted(docs_to_rank, key=lambda x: x['rerank_score'], reverse=True)

        return sorted_docs[:top_k]

    except Exception as e:
        logger.error(f"Reranking failed: {e}")
        # Fallback: return original documents
        return documents[:top_k]