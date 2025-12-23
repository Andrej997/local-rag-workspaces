"""
FastAPI main application entry point.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import asyncio

# Import routers
from routes import config, indexing, browse, buckets, search, stats, upload, visualization, metadata, scraping
from services.indexing_manager import get_indexing_manager
from middleware import register_exception_handlers
from utils.logger import get_logger

logger = get_logger(__name__)

app = FastAPI(
    title="Indexer Management API",
    description="API for managing codebase indexing with real-time progress",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Register centralized exception handlers
register_exception_handlers(app)

app.include_router(browse.router, prefix="/api", tags=["Browse"])
app.include_router(config.router, prefix="/api", tags=["Configuration"])
app.include_router(buckets.router, prefix="/api/buckets", tags=["Spaces"])
app.include_router(indexing.router, prefix="/api", tags=["Indexing"])
app.include_router(search.router, prefix="/api/search", tags=["Search"])
app.include_router(stats.router, prefix="/api/stats", tags=["Stats"])
app.include_router(upload.router, prefix="/api/upload", tags=["Upload"])
app.include_router(visualization.router, prefix="/api", tags=["Visualization"])
app.include_router(metadata.router, prefix="/api/metadata", tags=["Metadata"])
app.include_router(scraping.router, prefix="/api/scraping", tags=["Web Scraping"])

@app.on_event("startup")
async def startup_event():
    manager = get_indexing_manager()
    asyncio.create_task(manager.broadcast_progress())
    logger.info("Indexer Management API started successfully")

@app.get("/")
async def root():
    return {"message": "Indexer Management API", "docs": "/docs", "websocket": "/ws/indexing"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)