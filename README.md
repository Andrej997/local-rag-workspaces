# Local RAG Workspaces

A workspace-based Retrieval-Augmented Generation (RAG) system for private document chat with your files and codebases using local AI models. This local RAG solution enables you to organize multiple projects into isolated workspaces (also called "spaces" throughout the interface) and query them using vector search and large language models. Built with React, FastAPI, Milvus, and Ollama.

## ⚠️ Experimental Project

**This is an experimental project for educational purposes.**

This solution is provided as-is for learning and experimentation with RAG systems. It is NOT production-ready and should NOT be used in production environments without proper security hardening. Use at your own risk.

---

## Overview

Local RAG Workspaces is a self-hosted, workspace-based RAG system for indexing and querying documents and source code using vector search and LLMs. Each workspace maintains isolated collections of documents, embeddings, and chat history for different projects or topics. All data stays local with no external API calls, ensuring complete privacy for your documents and conversations.

**Note**: The terms "workspace" and "space" are used interchangeably throughout this application and documentation.

## Key Features

### 🚀 Multi-Format Support
- **Documents**: PDF, Word (`.docx`), Excel (`.xlsx`), PowerPoint (`.pptx`)
- **Code**: 60+ languages including Python, JavaScript, TypeScript, Java, C++, Rust, Go
- **Data**: JSON, YAML, CSV, XML, Markdown
- **Config**: `.env`, `.ini`, `.cfg`, `.gitignore`, Dockerfiles

### 💬 Streaming Chat Interface
- Real-time streaming responses (like ChatGPT)
- Multiple chat sessions per space
- Source attribution with similarity scores
- Non-blocking UI during generation

### 🔧 Configurable Per Space
- **LLM Models**: llama3.3, llama3.2, llama3.1, llama3, mistral, deepseek-r1, gpt-oss
- **Embedding Models**: nomic-embed-text (768d), mxbai-embed-large (1024d), all-minilm (384d)
- **Chunk Size**: 100-5000 characters
- **Temperature**: 0.0-1.0 for creativity control

### 📊 Advanced Features
- Interactive 3D/2D visualization of document embeddings
- Real-time indexing progress via WebSockets
- Automatic file type filtering
- Multi-session chat history
- Per-space configuration

## Prerequisites

1. **Python 3.8+** and **Node.js 16+**
2. **Ollama** - [Install here](https://ollama.ai)
3. **Docker & Docker Compose** - For Milvus and MinIO

**Install Required Ollama Models:**
```bash
# Embedding model (required)
ollama pull nomic-embed-text

# Chat model (default)
ollama pull llama3.2

# Optional: Other models
ollama pull llama3.3
ollama pull mistral
ollama pull deepseek-r1
```

## Environment Configuration

### Setting Up .env File

The project uses environment variables for configuration. Before starting, set up your `.env` file:

```bash
# Copy the example file
cp .env.example .env

# Edit with your preferred settings (optional)
nano .env
```

**Important Configuration:**

```env
# CRITICAL: Change these in production!
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin

# Application Ports (change if conflicts)
FRONTEND_PORT=80
BACKEND_PORT=8000
MILVUS_PORT=19530
MINIO_API_PORT=9000
MINIO_CONSOLE_PORT=9001

# Ollama Connection
OLLAMA_HOST=http://host.docker.internal:11434
```

### Available Configuration Options

All configurable parameters are documented in `.env.example`. Key categories:

- **Security**: MinIO credentials (⚠️ change in production!)
- **Ports**: All service ports (customize if conflicts)
- **Versions**: Docker image versions (pin for stability)
- **Storage**: Volume locations
- **Healthchecks**: Intervals and timeouts

### For Local Development (No Docker)

If running backend/frontend locally without Docker:

1. Create `backend/.env`:
```env
MILVUS_HOST=localhost
MILVUS_PORT=19530
MINIO_HOST=localhost
MINIO_PORT=9000
OLLAMA_HOST=http://localhost:11434
```

2. Start infrastructure only:
```bash
docker-compose up etcd minio standalone -d
```

3. Run backend and frontend from their directories (see their READMEs)

## Quick Start

### 1. Start Infrastructure (Milvus + MinIO)

```bash
docker-compose up -d
```

This starts:
- **Milvus** (vector database) on port 19530
- **MinIO** (object storage) on port 9000/9001

### 2. Start Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Backend will be available at:
- **API**: http://localhost:8000
- **Docs**: http://localhost:8000/docs

### 3. Start Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend will be available at: **http://localhost:5173**

## Usage Guide

### Creating a Space

1. Click **"+ New Space"** in the sidebar
2. Enter a name (e.g., "My Project")
3. Configure:
   - **LLM Model**: Which model to use for chat (llama3.2, mistral, etc.)
   - **Embedding Model**: Which model for vector search
   - **Chunk Size**: Text chunk size (default: 1000)
   - **Temperature**: 0 = precise, 1 = creative
4. Click **Create**

### Adding Files

**Option 1: Upload Files**
1. Go to your space
2. Click **"Upload Files"**
3. Select files (supports PDFs, Office docs, code files)
4. Unsupported files are automatically filtered

**Option 2: Browse Directories**
1. Use the directory browser
2. Navigate to your project folder
3. Add entire directories at once

### Indexing

1. Click **"Start Indexing"** button
2. Watch real-time progress (files processed, chunks created)
3. System auto-detects embedding dimensions on first run
4. Indexing extracts text, creates chunks, generates embeddings

### Chatting

1. Go to the **Chat** tab
2. Ask questions about your documents
3. Responses stream in real-time (like ChatGPT)
4. See which documents were used (source references)
5. Create new sessions with **"New Chat"** button

### Settings

Go to **Settings** to:
- Change LLM model (applies immediately to new chats)
- Change embedding model (**requires re-indexing**)
- Adjust chunk size (**requires re-indexing**)
- Adjust temperature (response creativity)
- View space stats
- Delete space

## Services

| Service | URL | Description | .env Variable |
|---------|-----|-------------|---------------|
| Frontend | http://localhost:80* | React UI | `FRONTEND_PORT` |
| Backend API | http://localhost:8000* | FastAPI endpoints | `BACKEND_PORT` |
| API Docs | http://localhost:8000*/docs | Swagger UI | `BACKEND_PORT` |
| MinIO Console | http://localhost:9001* | Object storage UI | `MINIO_CONSOLE_PORT` |
| MinIO API | http://localhost:9000* | S3-compatible API | `MINIO_API_PORT` |
| Milvus | localhost:19530* | Vector database | `MILVUS_PORT` |

*Ports are configurable via `.env` file

## Architecture

```
┌─────────────┐      ┌──────────────┐      ┌─────────┐
│   React     │◄────►│   FastAPI    │◄────►│ Ollama  │
│  Frontend   │ HTTP │   Backend    │      │ (LLMs)  │
└─────────────┘ WS   └──────────────┘      └─────────┘
                            │
                ┌───────────┼───────────┐
                ▼           ▼           ▼
           ┌────────┐  ┌────────┐  ┌────────┐
           │ Milvus │  │ MinIO  │  │ SQLite │
           │ Vector │  │ Object │  │  Chat  │
           │   DB   │  │Storage │  │History │
           └────────┘  └────────┘  └────────┘
```

## Supported File Types

### Documents
✅ PDF, Word (`.docx`), Excel (`.xlsx`, `.xls`), PowerPoint (`.pptx`)

### Programming Languages
✅ Python, JavaScript, TypeScript, Java, C/C++, Rust, Go, PHP, Ruby, Swift, Kotlin, Scala, and 50+ more

### Data & Config
✅ JSON, YAML, XML, CSV, Markdown, TOML, INI, ENV files

### Automatically Filtered
❌ Images (PNG, JPG, SVG), Videos (MP4, AVI), Binaries (EXE, DLL), Archives (ZIP, TAR)

**Excluded directories**: `.git`, `venv`, `__pycache__`, `node_modules`

## Configuration

### Space Settings (Per-Space)

Each space has independent configuration:
- **Chunk Size**: 100-5000 characters (how text is split)
- **LLM Model**: llama3.3, llama3.2, llama3.1, llama3, mistral, deepseek-r1, gpt-oss
- **Embedding Model**: nomic-embed-text, mxbai-embed-large, all-minilm
- **Temperature**: 0.0-1.0 (response randomness)

### Embedding Models

| Model | Dimensions | Use Case | Command |
|-------|-----------|----------|---------|
| nomic-embed-text | 768 | Default, best general purpose | `ollama pull nomic-embed-text` |
| mxbai-embed-large | 1024 | Higher quality, larger | `ollama pull mxbai-embed-large` |
| all-minilm | 384 | Fast, lightweight | `ollama pull all-minilm` |

**Note**: Changing embedding model requires complete re-indexing of the space.

### Data Storage

- **Space config**: MinIO (`{bucket}/config.json`)
- **Uploaded files**: MinIO (`{bucket}/uploads/`)
- **Chat history**: SQLite (`backend/chat_history.db`)
- **Vector embeddings**: Milvus (port 19530)
- **Milvus data**: Docker volume
- **MinIO data**: Docker volume

## Troubleshooting

### Connection Issues

**"Failed to connect to Milvus"**
```bash
# Check if Milvus is running
docker ps | grep milvus

# Start if not running
docker-compose up -d
```

**"Ollama connection failed"**
```bash
# Ensure Ollama is running
ollama serve

# Check installed models
ollama list
```

**"MinIO connection failed"**
```bash
# Check if MinIO is running
docker ps | grep minio

# Access MinIO console
# http://localhost:9001 (minioadmin/minioadmin)
```

### Chat Issues

**"Chat responses blocked"**
- Backend uses thread pools for non-blocking operations
- Check browser console for errors
- Verify backend logs for issues
- Ensure models are pulled in Ollama

**"Streaming not working"**
- Check CORS configuration in backend
- Verify browser supports fetch streaming
- Check network tab for SSE events

**"Query very slow"**
- Check Ollama model is loaded: `ollama list`
- Verify Milvus index is created
- Try smaller embedding model (all-minilm)
- Reduce chunk count or query length

### Indexing Issues

**"No files indexed"**
- Verify paths contain supported file types
- Check excluded directories (`.git`, `node_modules`, etc.)
- Review backend logs for errors
- Ensure embedding model is pulled

**"Indexing fails"**
- Check file types are supported
- Ensure enough disk space
- Verify Ollama embedding model is available
- Check backend logs for specific errors

**"Embedding dimension mismatch"**
- Different embedding models have different dimensions
- **Must re-index** space after changing embedding model
- Delete collection and re-run indexing

### Upload Issues

**"Upload rejected"**
- Files may be unsupported format (images, videos, binaries)
- Check response for `skipped_files` array
- Review supported file types list above
- Check MinIO storage space

**"Upload slow"**
- Large files take time to process
- Check network connection
- Verify MinIO is running properly

### Port Conflicts

**Default ports (configurable via `.env`):**
- 80 - Frontend (`FRONTEND_PORT`)
- 8000 - Backend API (`BACKEND_PORT`)
- 19530 - Milvus (`MILVUS_PORT`)
- 9000 - MinIO API (`MINIO_API_PORT`)
- 9001 - MinIO Console (`MINIO_CONSOLE_PORT`)

**Check if port is in use:**
```bash
# Windows
netstat -ano | findstr :8000

# Linux/Mac
lsof -i :8000
```

**Solution - Change ports in `.env` file:**
```env
# Example: Use different ports
FRONTEND_PORT=3000
BACKEND_PORT=8080
MILVUS_PORT=19531
MINIO_API_PORT=9002
MINIO_CONSOLE_PORT=9003
```

Then restart services:
```bash
docker-compose down
docker-compose up -d
```

## Project Structure

```
local-rag/
├── frontend/              # React frontend
│   ├── src/
│   │   ├── components/    # UI components
│   │   ├── services/      # API client
│   │   └── context/       # State management
│   └── README.md          # Frontend docs
├── backend/               # FastAPI backend
│   ├── routes/            # API endpoints
│   ├── services/          # Business logic
│   ├── models/            # Pydantic schemas
│   └── README.md          # Backend docs
├── docker-compose.yml     # Infrastructure setup
├── .env                   # Environment configuration (gitignored)
├── .env.example          # Environment template
└── README.md              # This file
```

## Environment Variables

The system uses a `.env` file for configuration. See `.env.example` for all available options.

**Quick reference:**

| Category | Variables | Purpose |
|----------|-----------|---------|
| **Security** | `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY` | MinIO credentials |
| **Ports** | `FRONTEND_PORT`, `BACKEND_PORT`, `MILVUS_PORT`, etc. | Service ports |
| **Versions** | `MILVUS_VERSION`, `MINIO_VERSION`, `ETCD_VERSION` | Docker image versions |
| **Connections** | `OLLAMA_HOST`, `MILVUS_HOST` | Service endpoints |
| **Storage** | `DOCKER_VOLUME_DIRECTORY` | Volume location |

**All variables have sensible defaults** - the system works out-of-the-box. Only customize if needed.

## Tech Stack

### Frontend
- React 18
- Vite (build tool)
- React Router (routing)
- Plotly.js (3D visualizations)
- React Markdown (rendering)

### Backend
- FastAPI (web framework)
- Ollama (LLM inference)
- PyMilvus (vector database)
- pypdf, python-docx, openpyxl, python-pptx (document parsers)
- WebSockets (real-time updates)

### Infrastructure
- Milvus (vector database)
- MinIO (S3-compatible object storage)
- SQLite (chat history)
- Docker & Docker Compose

## Performance Tips

1. **Chunk Size**: Smaller = more precise, larger = more context
2. **Embedding Model**: all-minilm is fastest, mxbai-embed-large is most accurate
3. **LLM Model**: Smaller models (7B) are faster than larger (70B+)
4. **Top-K Search**: Default 5 chunks, increase for broader context
5. **Temperature**: Lower (0.2) for precise, higher (0.8) for creative responses

## Security Notes

⚠️ **This system is designed for local use only**

### Current Security Posture

- No authentication by default
- No rate limiting
- No file size limits
- Assumes trusted local environment
- Default MinIO credentials are weak

### .env File Security

🔒 **CRITICAL: Protect your .env file**

```bash
# Add to .gitignore (already included)
.env

# Never commit .env to version control
# Use .env.example for templates

# For production: Generate strong credentials
MINIO_ACCESS_KEY=<generate-strong-random-key>
MINIO_SECRET_KEY=<generate-strong-random-key>
```

**Generate secure credentials:**
```bash
# Linux/Mac
openssl rand -base64 32

# Windows PowerShell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
```

### For Production Deployment

**REQUIRED security additions:**
- ✅ Change all default credentials in `.env`
- ✅ Authentication middleware (JWT, OAuth)
- ✅ Rate limiting
- ✅ File size validation
- ✅ Input sanitization
- ✅ Network security rules
- ✅ HTTPS/TLS
- ✅ Firewall rules (only expose necessary ports)
- ✅ Regular security updates

## API Documentation

Interactive API documentation available at:
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

For detailed API information, see `backend/README.md`

## Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Update documentation
6. Submit a pull request

## License

See LICENSE file for details.

## Acknowledgments

- **Ollama** - Local LLM inference
- **Milvus** - Vector database
- **FastAPI** - Backend framework
- **React** - Frontend framework
- **MinIO** - Object storage

---

**Built for local-first AI applications** 🚀

For detailed component documentation:
- [Frontend README](frontend/README.md)
- [Backend README](backend/README.md)
