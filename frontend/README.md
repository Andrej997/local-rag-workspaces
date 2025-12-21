# Local RAG - Frontend

React-based frontend for the Local RAG system, providing an intuitive interface for managing document spaces, indexing files, and chatting with your codebase using AI.

## Features

### Space Management
- **Create Spaces**: Organize different projects or document collections
- **Configure Settings**: Per-space configuration for LLM models, embedding models, chunk size, and temperature
- **File Upload**: Support for multiple file formats including PDFs, Office documents, and code files
- **Directory Browser**: Upload and manage entire directory structures

### Chat Interface
- **Streaming Responses**: Real-time streaming chat responses for better UX
- **Session Management**: Create, switch between, and manage multiple chat sessions per space
- **Source References**: View which documents were used to generate responses
- **Markdown Support**: Rich text rendering for code blocks and formatting

### Indexing & Visualization
- **Real-time Progress**: Live WebSocket updates during file indexing
- **Vector Visualization**: 2D and 3D visualizations of document embeddings
- **Statistics Dashboard**: Track indexed files, chat sessions, and space metrics

### Configuration Options
- **LLM Models**: llama3.3, llama3.2, llama3.1, llama3, mistral, gpt-oss, deepseek-r1
- **Embedding Models**:
  - nomic-embed-text (768 dim) - Default
  - mxbai-embed-large (1024 dim) - Higher quality
  - all-minilm (384 dim) - Fast and lightweight
- **Chunk Size**: 100-5000 characters per vector chunk
- **Temperature**: 0.0-1.0 for response creativity

## Tech Stack

- **React 18** - UI library
- **Vite** - Build tool and dev server
- **React Router** - Client-side routing
- **React Markdown** - Markdown rendering in chat
- **Plotly.js** - Interactive 3D/2D visualizations
- **WebSockets** - Real-time indexing progress updates

## Project Structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── BucketManager.jsx       # Space creation and selection
│   │   ├── ProjectChat.jsx         # Chat interface with streaming
│   │   ├── SettingsPage.jsx        # Space configuration
│   │   ├── IndexingControl.jsx     # Indexing controls
│   │   ├── IndexVisualization.jsx  # Vector embeddings visualization
│   │   ├── SpacePage.jsx           # Main space dashboard
│   │   └── ...
│   ├── context/
│   │   └── IndexingContext.jsx     # Global state management
│   ├── services/
│   │   └── api.js                  # API client for backend
│   ├── App.jsx                     # Main app component
│   └── main.jsx                    # Entry point
├── public/
├── index.html
├── package.json
└── vite.config.js
```

## Getting Started

### Prerequisites

- Node.js 16+ and npm
- Backend server running on `http://localhost:8000`

### Installation

```bash
cd frontend
npm install
```

### Development

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

### Build for Production

```bash
npm run build
```

The built files will be in the `dist/` directory.

## API Integration

The frontend connects to the backend API at `http://localhost:8000/api`. Key endpoints:

- **Spaces**: `/api/buckets` - CRUD operations for spaces
- **Upload**: `/api/upload/{bucket_name}` - File uploads
- **Indexing**: `/api/indexing/start` - Start/stop indexing
- **Search**: `/api/search/` - Streaming chat endpoint
- **Visualization**: `/api/visualization/{bucket_name}` - Get embeddings data
- **WebSocket**: `/ws/indexing` - Real-time progress updates

## Supported File Types

### Documents
- PDF (`.pdf`)
- Word (`.docx`)
- Excel (`.xlsx`, `.xls`)
- PowerPoint (`.pptx`)

### Text & Data
- Markdown (`.md`), Text (`.txt`)
- JSON, YAML, CSV, XML
- Config files (`.env`, `.ini`, `.cfg`)

### Code
- JavaScript/TypeScript (`.js`, `.jsx`, `.ts`, `.tsx`)
- Python (`.py`), Java (`.java`), Go (`.go`)
- C/C++ (`.c`, `.cpp`, `.h`), Rust (`.rs`)
- And 60+ other programming languages

Unsupported files (images, videos, binaries) are automatically filtered during upload.

## Environment Variables

No environment variables required - API URL is hardcoded for local development.

To change the backend URL, edit `frontend/src/services/api.js`:

```javascript
const API_BASE_URL = 'http://your-backend-url:8000/api';
```

## Features in Detail

### Streaming Chat
- Uses native `fetch()` with Server-Sent Events (SSE)
- Progressive response rendering
- Non-blocking UI during generation
- Automatic scroll to latest message

### Vector Visualization
- Interactive 3D scatter plot with Plotly
- Color-coded by file type
- UMAP dimensionality reduction
- Switchable 2D/3D views

### Session Management
- Multiple chat sessions per space
- Session history persistence
- Quick session switching
- Named sessions with timestamps

## Troubleshooting

**Chat not working?**
- Ensure backend is running on port 8000
- Check that space has been indexed
- Verify Ollama models are pulled: `ollama pull llama3.2`

**Upload fails?**
- Check file types are supported
- Ensure backend MinIO service is running
- Check browser console for errors

**Indexing stuck?**
- Refresh page to reconnect WebSocket
- Check backend logs for errors
- Verify Ollama embedding model is available

## Contributing

When making changes:
1. Follow existing code structure
2. Use functional components with hooks
3. Keep components focused and single-responsibility
4. Update this README if adding major features

## License

See main project LICENSE file.
