# Local RAG - Backend

FastAPI-based backend for the Local RAG system, providing document indexing, vector search, and streaming chat capabilities using Ollama and Milvus.

## Features

### Document Processing
- **Multi-format Support**: PDF, DOCX, XLSX, PPTX, and 60+ code file types
- **Chunking**: Configurable text chunking (100-5000 characters)
- **Vector Embeddings**: Multiple embedding models with auto-dimension detection
- **Incremental Indexing**: Add files to existing spaces without re-indexing

### Vector Search
- **Milvus Integration**: High-performance vector database
- **Semantic Search**: Find relevant documents using embeddings
- **Configurable Retrieval**: Top-K search with similarity scoring
- **Per-space Collections**: Isolated vector stores for each space

### Chat Interface
- **Streaming Responses**: Server-Sent Events (SSE) for real-time streaming
- **RAG Pipeline**: Retrieval-Augmented Generation with context
- **Session Management**: Persistent chat history with SQLite
- **Non-blocking Architecture**: Async operations with thread pools

### Storage
- **MinIO**: S3-compatible object storage for files
- **SQLite**: Chat history and session persistence
- **Milvus**: Vector embeddings storage
- **JSON Config**: Space configuration in MinIO

## Tech Stack

- **FastAPI** - Modern async web framework
- **Ollama** - Local LLM and embedding models
- **Milvus** - Vector database
- **MinIO** - Object storage
- **PyMilvus** - Milvus Python client
- **pypdf** - PDF text extraction
- **python-docx** - Word document parsing
- **openpyxl** - Excel spreadsheet parsing
- **python-pptx** - PowerPoint parsing
- **WebSockets** - Real-time progress updates

## Project Structure

```
backend/
├── routes/
│   ├── search.py          # Chat and search endpoints (streaming)
│   ├── indexing.py        # Indexing control endpoints
│   ├── buckets.py         # Space management
│   ├── upload.py          # File upload handling
│   ├── visualization.py   # Vector embeddings data
│   └── stats.py           # Statistics and metrics
├── services/
│   ├── indexer_core.py    # Core indexing logic with callbacks
│   ├── indexing_manager.py # Indexing orchestration + WebSocket
│   ├── bucket_manager.py   # Space lifecycle management
│   ├── minio_service.py    # MinIO client wrapper
│   ├── chat_manager.py     # Chat history (SQLite)
│   └── file_types.py       # Supported file extensions
├── models/
│   └── schemas.py         # Pydantic models
├── main.py                # FastAPI app entry point
└── requirements.txt       # Python dependencies
```

## Getting Started

### Prerequisites

- Python 3.8+
- Ollama installed and running
- Milvus running (via Docker)
- MinIO running (via Docker)

### Installation

```bash
cd backend
pip install -r requirements.txt
```

### Environment Variables

```bash
# Optional - defaults shown
MILVUS_HOST=localhost
MILVUS_PORT=19530
MINIO_HOST=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
```

### Running the Server

```bash
# Development with auto-reload
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Or using the main.py entry point
python -m backend.main
```

The API will be available at `http://localhost:8000`

### API Documentation

Interactive API docs available at:
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

## Core Components

### Indexing Pipeline

1. **File Upload** (`upload.py`)
   - Validates file types against whitelist
   - Uploads to MinIO bucket under `uploads/`
   - Syncs bucket state

2. **Indexing** (`indexer_core.py`)
   - Downloads files from MinIO to cache
   - Extracts text based on file type
   - Chunks text (configurable size)
   - Generates embeddings using Ollama
   - Creates Milvus collection with auto-detected dimensions
   - Inserts vectors and creates index

3. **Progress Tracking** (`indexing_manager.py`)
   - WebSocket broadcasting
   - Real-time file/chunk counts
   - Error reporting
   - Auto-saves embedding dimension

### Search & Chat Pipeline

1. **Query Processing** (`search.py`)
   - Reads space configuration
   - Generates query embedding (same model as indexing)
   - Searches Milvus for top-K similar chunks

2. **Context Building**
   - Retrieves top 5 most relevant chunks
   - Formats context with file sources

3. **Response Generation**
   - Streams response using Ollama
   - Saves to chat history
   - Returns sources with similarity scores

4. **Async Architecture**
   - Background thread pools for blocking operations
   - Queue-based communication
   - Non-blocking event loop

## API Endpoints

### Spaces
```
GET    /api/buckets              # List all spaces
POST   /api/buckets              # Create space
PUT    /api/buckets/{name}/config # Update config
DELETE /api/buckets/{name}       # Delete space
POST   /api/buckets/{name}/select # Select current
```

### Upload
```
POST   /api/upload/{bucket_name}  # Upload files (multipart)
```

### Indexing
```
POST   /api/indexing/start        # Start indexing
POST   /api/indexing/stop         # Stop indexing
GET    /api/indexing/status       # Get status
WS     /ws/indexing               # WebSocket for progress
```

### Search & Chat
```
POST   /api/search/                          # Stream chat (SSE)
GET    /api/search/history/{bucket_name}     # Get history
DELETE /api/search/history/{bucket_name}     # Clear history
GET    /api/search/sessions/{bucket_name}    # List sessions
POST   /api/search/sessions/{bucket_name}/new # New session
GET    /api/search/sessions/{bucket_name}/{id} # Load session
```

### Visualization
```
GET    /api/visualization/{bucket_name}?dim=2  # Get embeddings (2D/3D)
```

### Statistics
```
GET    /api/stats                           # System stats
GET    /api/stats/space/{bucket_name}       # Space stats
```

## Configuration

### Space Configuration (BucketConfig)

```python
{
  "chunk_size": 1000,           # Characters per chunk (100-5000)
  "llm_model": "llama3.2",      # Ollama chat model
  "embedding_model": "nomic-embed-text",  # Ollama embedding model
  "embedding_dim": 768,         # Auto-detected
  "temperature": 0.7            # LLM temperature (0.0-1.0)
}
```

### Supported Embedding Models

| Model | Dimensions | Command |
|-------|-----------|---------|
| nomic-embed-text | 768 | `ollama pull nomic-embed-text` |
| mxbai-embed-large | 1024 | `ollama pull mxbai-embed-large` |
| all-minilm | 384 | `ollama pull all-minilm` |

### Supported LLM Models

- llama3.3, llama3.2, llama3.1, llama3
- mistral
- deepseek-r1
- Any other Ollama model

## File Type Support

### Documents (services/file_types.py)
- **PDF**: pypdf extraction
- **Word**: python-docx (paragraphs + tables)
- **Excel**: openpyxl (all sheets, cell values)
- **PowerPoint**: python-pptx (slide text)

### Code & Text
- 60+ programming languages
- Markdown, JSON, YAML, XML, CSV
- Config files, logs

Unsupported files (images, videos, binaries) are filtered during upload.

## Database Schema

### Milvus Collections
```python
Collection: {bucket_name}
  - id: INT64 (auto)
  - content: VARCHAR(5000)
  - filename: VARCHAR(500)
  - embedding: FLOAT_VECTOR(dim=auto-detected)

Index: IVF_FLAT (L2 distance)
```

### SQLite (chat_history.db)
```sql
CREATE TABLE chat_sessions (
  id INTEGER PRIMARY KEY,
  bucket_name TEXT,
  created_at TIMESTAMP,
  name TEXT
);

CREATE TABLE chat_messages (
  id INTEGER PRIMARY KEY,
  session_id INTEGER,
  role TEXT,  -- 'user' | 'assistant' | 'system'
  content TEXT,
  sources JSON,  -- Optional retrieval sources
  timestamp TIMESTAMP
);
```

### MinIO Structure
```
{bucket-name}/
  ├── config.json          # Space configuration
  └── uploads/
      ├── file1.pdf
      ├── folder/
      │   └── file2.py
      └── ...
```

## Performance Considerations

### Indexing
- **Batch Processing**: Inserts vectors in batches
- **Thread Safety**: Single indexer instance at a time
- **Memory**: Large files loaded in chunks
- **Cache**: Downloads to `/tmp/indexer_cache/` during indexing

### Search
- **Non-blocking**: Async operations with thread pools
- **Streaming**: Reduces time-to-first-byte
- **Connection Pooling**: Reuses Milvus connections
- **Top-K**: Default 5 chunks (configurable)

### Scaling
- Single-node deployment for local use
- For production: Milvus cluster, Redis for chat history
- Horizontal scaling: Run multiple API instances behind load balancer

## Troubleshooting

### Indexing Issues

**"No module named 'ollama'"**
```bash
pip install ollama
```

**"Failed to connect to Milvus"**
```bash
# Check Milvus is running
docker ps | grep milvus

# Verify connection
curl http://localhost:19530/health
```

**"Embedding dimension mismatch"**
- Different embedding models have different dimensions
- Re-index space after changing embedding model

### Chat Issues

**"Streaming not working"**
- Check CORS configuration in `main.py`
- Verify `expose_headers=["*"]` is set

**"Query very slow"**
- Check Ollama model is loaded: `ollama list`
- Verify Milvus index is created
- Reduce chunk count or simplify query

### Storage Issues

**"MinIO connection failed"**
```bash
# Check MinIO is running
docker ps | grep minio

# Test access
curl http://localhost:9000
```

**"Out of disk space"**
- Clear MinIO buckets
- Clean up Milvus collections: `utility.drop_collection(name)`
- Remove cache: `rm -rf /tmp/indexer_cache/`

## Development

### Adding New File Types

1. Add extraction logic to `indexer_core.py`:
```python
elif file_lower.endswith('.new_ext'):
    # Extract text
    text = extract_from_new_format(path)
```

2. Add to supported extensions in `file_types.py`:
```python
SUPPORTED_DOCUMENTS.add('.new_ext')
```

### Adding New Endpoints

1. Create route in `routes/`
2. Register in `main.py`:
```python
from routes import new_route
app.include_router(new_route.router, prefix="/api/new", tags=["New"])
```

## Docker Deployment

Required services (use docker-compose):

```yaml
version: '3.8'
services:
  milvus:
    image: milvusdb/milvus:latest
    ports:
      - "19530:19530"

  minio:
    image: minio/minio:latest
    ports:
      - "9000:9000"
      - "9001:9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    command: server /data --console-address ":9001"
```

## Security Considerations

- **Local Use**: Designed for trusted local environment
- **No Authentication**: Add auth middleware for production
- **File Upload**: Validates file types, but no size limits
- **SQL Injection**: Uses parameterized queries
- **XSS**: Frontend sanitizes markdown rendering

## Contributing

When adding features:
1. Follow existing patterns (callbacks, async/await)
2. Add type hints with Pydantic models
3. Update OpenAPI schemas
4. Test with multiple file types
5. Update this README

## License

See main project LICENSE file.
