from sentence_transformers import CrossEncoder
import torch

# Initialize model globally to avoid reloading on every request
# Use CPU by default, or CUDA if available
device = 'cuda' if torch.cuda.is_available() else 'cpu'
print(f"Loading Reranker model on {device}...")
model = CrossEncoder('cross-encoder/ms-marco-MiniLM-L-6-v2', max_length=512, device=device)
print("Reranker model loaded.")

def rerank_documents(query: str, documents: list, top_k: int = 5):
    """
    Rerank a list of documents based on relevance to the query.
    documents: list of dicts, must contain 'content' key.
    """
    if not documents:
        return []
        
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