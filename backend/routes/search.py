"""
API routes for RAG Chat with History Persistence.
Implements Advanced RAG: Hybrid Search (Vector + BM25) + Reranking + Query Expansion.
"""
import json
import asyncio
from queue import Queue
from threading import Thread
import ollama
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List
from services.chat_manager import chat_manager
from services.bucket_manager import bucket_manager
from services.milvus_service import get_milvus_service
from services.rag_service import get_rag_service
from utils.logger import get_logger
from utils.sanitizers import sanitize_collection_name

logger = get_logger(__name__)
router = APIRouter()

# Get service instances
milvus_service = get_milvus_service()
rag_service = get_rag_service()

class ChatRequest(BaseModel):
    bucket_name: str
    query: str

class ChatResponse(BaseModel):
    answer: str
    sources: List[dict]

class HistoryResponse(BaseModel):
    history: List[dict]


# --- Session Management Routes ---

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

    # 3. Get collection name and verify it exists
    collection_name = sanitize_collection_name(request.bucket_name)

    # Check index existence using MilvusService
    if not milvus_service.collection_exists(collection_name, sanitize=False):
        error_msg = f"No index found for space '{request.bucket_name}'. Please index some files first."
        chat_manager.save_message(request.bucket_name, "assistant", error_msg)
        logger.warning(f"No collection found for bucket '{request.bucket_name}'")
        raise HTTPException(status_code=404, detail=error_msg)

    # 3. Hybrid Retrieval & Reranking (Runs in Thread Pool)
    async def get_context_advanced():
        """Retrieve context using advanced RAG service"""
        def blocking_retrieval():
            return rag_service.retrieve_context(
                query=request.query,
                collection_name=collection_name,
                bucket_name=request.bucket_name,
                embedding_model=embedding_model,
                top_k=5,
                enable_reranking=True
            )

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
                    logger.error(f"Error in streaming chat: {error_msg}")
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
            logger.error(f"Stream generation failed: {str(e)}")
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(generate_stream(), media_type="text/event-stream")