"""
API routes for RAG Chat with History Persistence.
Implements Advanced RAG: Hybrid Search (Vector + BM25) + Reranking + Query Expansion.
"""
import os
import re
import json
import asyncio
from queue import Queue
from threading import Thread
import ollama
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional
from pymilvus import connections, Collection, utility
from services.chat_manager import chat_manager
from services.bucket_manager import bucket_manager
# Import Advanced RAG Services
from services.bm25_service import BM25Service
from services.reranker_service import rerank_documents

router = APIRouter()

class ChatRequest(BaseModel):
    bucket_name: str
    query: str

class ChatResponse(BaseModel):
    answer: str
    sources: List[dict]

class HistoryResponse(BaseModel):
    history: List[dict]

def get_collection_name(bucket_name: str) -> str:
    return re.sub(r'[^a-zA-Z0-9_]', '_', bucket_name)

def connect_milvus():
    try:
        milvus_host = os.getenv("MILVUS_HOST", "localhost")
        milvus_port = os.getenv("MILVUS_PORT", "19530")
        connections.connect("default", host=milvus_host, port=milvus_port)
    except Exception as e:
        print(f"Milvus connection error: {e}")
        raise HTTPException(status_code=500, detail="Could not connect to vector database")

# --- Advanced RAG Helpers ---

def expand_query(original_query: str, model_name: str) -> List[str]:
    """Use LLM to generate variations of the user query."""
    try:
        prompt = (
            f"Generate 3 different search queries to answer this user question. "
            f"Focus on technical terms and synonyms. "
            f"Output only the queries, one per line. Do not number them.\n\n"
            f"User Question: {original_query}"
        )
        response = ollama.chat(model=model_name, messages=[{'role': 'user', 'content': prompt}])
        content = response['message']['content']
        # Parse lines
        queries = [line.strip().lstrip('- ') for line in content.split('\n') if line.strip()]
        return list(set([original_query] + queries))
    except Exception as e:
        print(f"Query expansion failed: {e}")
        return [original_query]

def reciprocal_rank_fusion(results_list: List[List[dict]], k=60):
    """
    Combines results from multiple sources (Vector, BM25).
    Each item in results_list is a list of dicts with 'content' and 'filename'.
    """
    fused_scores = {}
    
    for results in results_list:
        for rank, doc in enumerate(results):
            # Create a unique key (filename + content hash snippet)
            # This handles duplicate chunks found by different methods
            key = f"{doc['filename']}_{hash(doc['content'][:50])}"
            
            if key not in fused_scores:
                fused_scores[key] = {'doc': doc, 'score': 0.0}
            
            # RRF Formula: 1 / (rank + k)
            fused_scores[key]['score'] += 1 / (rank + k)
            
    # Convert back to list sorted by fused score
    final_results = sorted(fused_scores.values(), key=lambda x: x['score'], reverse=True)
    return [item['doc'] for item in final_results]

# --- Existing Routes ---

@router.get("/history/{bucket_name}", response_model=HistoryResponse)
async def get_chat_history(bucket_name: str):
    """Retrieve chat history for a space."""
    history = chat_manager.get_history(bucket_name)
    return HistoryResponse(history=history)

@router.delete("/history/{bucket_name}")
async def clear_chat_history(bucket_name: str):
    """Clear chat history for a space."""
    new_session_id = chat_manager.clear_history(bucket_name)
    return {"message": "History cleared", "new_session_id": new_session_id}

@router.get("/sessions/{bucket_name}")
async def list_sessions(bucket_name: str):
    """List all chat sessions for a space."""
    sessions = chat_manager.list_sessions(bucket_name)
    return {"sessions": sessions}

@router.post("/sessions/{bucket_name}/new")
async def create_new_session(bucket_name: str):
    """Create a new chat session."""
    new_session_id = chat_manager.clear_history(bucket_name)
    return {"session_id": new_session_id, "message": "New session created"}

@router.get("/sessions/{bucket_name}/{session_id}")
async def load_session(bucket_name: str, session_id: int):
    """Load a specific chat session."""
    history = chat_manager.load_session(bucket_name, session_id)
    return {"history": history, "session_id": session_id}

# --- Main Chat Route ---

@router.post("/")
async def chat(request: ChatRequest):
    if not request.bucket_name or not request.query:
        raise HTTPException(status_code=400, detail="Bucket name and query are required")

    # 1. Get Bucket Configuration
    buckets = bucket_manager.get_buckets()
    bucket = next((b for b in buckets if b.name == request.bucket_name), None)

    # Defaults
    llm_model = 'llama3.2'
    temperature = 0.7
    embedding_model = 'nomic-embed-text'

    if bucket and bucket.config:
        llm_model = bucket.config.llm_model
        temperature = bucket.config.temperature
        embedding_model = bucket.config.embedding_model

    # 2. Save User Message
    chat_manager.save_message(request.bucket_name, "user", request.query)

    connect_milvus()
    collection_name = get_collection_name(request.bucket_name)

    # Check index existence
    if not utility.has_collection(collection_name):
        error_msg = f"No index found for space '{request.bucket_name}'. Please index some files first."
        chat_manager.save_message(request.bucket_name, "assistant", error_msg)
        raise HTTPException(status_code=404, detail=error_msg)

    # 3. Hybrid Retrieval & Reranking (Runs in Thread Pool)
    async def get_context_advanced():
        def blocking_retrieval():
            all_results = []
            
            # A. Vector Search
            try:
                embedding_response = ollama.embeddings(model=embedding_model, prompt=request.query)
                query_vector = embedding_response['embedding']

                collection = Collection(collection_name)
                collection.load()

                results = collection.search(
                    data=[query_vector],
                    anns_field="embedding",
                    param={"metric_type": "L2", "params": {"nprobe": 10}},
                    limit=20, # Fetch more for reranking
                    output_fields=["content", "filename"]
                )
                
                vector_chunks = []
                for hits in results:
                    for hit in hits:
                        vector_chunks.append({
                            "filename": hit.entity.get("filename"),
                            "content": hit.entity.get("content"),
                            "score": hit.score,
                            "type": "vector"
                        })
                all_results.append(vector_chunks)
            except Exception as e:
                print(f"Vector search failed: {e}")

            # B. BM25 Keyword Search
            try:
                bm25 = BM25Service()
                if bm25.load_from_minio(request.bucket_name):
                    keyword_results = bm25.search(request.query, top_k=20)
                    all_results.append(keyword_results)
            except Exception as e:
                print(f"BM25 search failed: {e}")

            # C. Fusion (RRF)
            candidates = reciprocal_rank_fusion(all_results)
            
            # D. Reranking (Cross-Encoder)
            # Take top 50 candidates and rerank to top 5
            try:
                final_chunks = rerank_documents(request.query, candidates[:50], top_k=5)
            except Exception as e:
                print(f"Reranking failed, falling back to raw results: {e}")
                final_chunks = candidates[:5]

            # Format Context
            context_str = ""
            for chunk in final_chunks:
                context_str += f"\n--- File: {chunk['filename']} ---\n{chunk['content']}\n"
                
            return final_chunks, context_str

        return await asyncio.to_thread(blocking_retrieval)

    # 4. Stream Generator Function
    async def generate_stream():
        try:
            # Get context in background thread
            retrieved_chunks, context_str = await get_context_advanced()
            full_answer = ""

            # Send sources first
            yield f"data: {json.dumps({'type': 'sources', 'sources': retrieved_chunks})}\n\n"

            # Generate streaming answer
            system_prompt = (
                "You are a helpful coding assistant. "
                "Answer the user's question based ONLY on the provided code context below. "
                "If the answer isn't in the context, say you don't know."
                "\n\nContext:" + context_str
            )

            # Use a queue to communicate between the blocking thread and async generator
            chunk_queue = Queue()

            def stream_chat_in_thread():
                """Run the blocking ollama chat in a separate thread"""
                try:
                    # Model availability check omitted for brevity, keeping core logic
                    stream = ollama.chat(
                        model=llm_model,
                        messages=[
                            {'role': 'system', 'content': system_prompt},
                            {'role': 'user', 'content': request.query},
                        ],
                        options={'temperature': temperature},
                        stream=True
                    )

                    for chunk in stream:
                        if chunk['message']['content']:
                            chunk_queue.put(('content', chunk['message']['content']))

                    chunk_queue.put(('done', None))
                except Exception as e:
                    error_msg = str(e)
                    chunk_queue.put(('error', error_msg))

            # Start the streaming thread
            thread = Thread(target=stream_chat_in_thread, daemon=True)
            thread.start()

            # Process chunks from the queue
            while True:
                chunk_type, chunk_data = await asyncio.to_thread(chunk_queue.get)

                if chunk_type == 'content':
                    full_answer += chunk_data
                    yield f"data: {json.dumps({'type': 'content', 'content': chunk_data})}\n\n"
                elif chunk_type == 'error':
                    yield f"data: {json.dumps({'type': 'error', 'message': chunk_data})}\n\n"
                    break
                elif chunk_type == 'done':
                    await asyncio.to_thread(
                        chat_manager.save_message,
                        request.bucket_name,
                        "assistant",
                        full_answer,
                        retrieved_chunks
                    )
                    yield f"data: {json.dumps({'type': 'done'})}\n\n"
                    break

        except Exception as e:
            print(f"Stream generation failed: {e}")
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(generate_stream(), media_type="text/event-stream")