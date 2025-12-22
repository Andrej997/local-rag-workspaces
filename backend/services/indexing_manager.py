"""
Indexing manager for orchestrating indexer execution and WebSocket communication.
"""
import asyncio
import threading
import os
import shutil
from queue import Queue
from typing import List, Optional, Dict, Any
from datetime import datetime

from fastapi import WebSocket
from services.indexer_core import IndexerWithCallbacks
from services.bucket_manager import bucket_manager
from services.minio_service import minio_service

class IndexingManager:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return

        self.is_running = False
        self.current_indexer: Optional[IndexerWithCallbacks] = None
        self.websocket_clients: List[WebSocket] = []
        self.progress_queue: Queue = Queue()
        self.last_progress: Optional[Dict[str, Any]] = None
        self._initialized = True

        # Load persisted progress on startup
        self._load_progress_state()

    def add_websocket(self, websocket: WebSocket):
        self.websocket_clients.append(websocket)
        if self.last_progress:
            asyncio.create_task(self._send_to_websocket(websocket, self.last_progress))

    def remove_websocket(self, websocket: WebSocket):
        if websocket in self.websocket_clients:
            self.websocket_clients.remove(websocket)

    async def _send_to_websocket(self, websocket: WebSocket, data: Dict[str, Any]):
        try:
            await websocket.send_json(data)
        except Exception as e:
            print(f"Error sending to WebSocket: {e}")
            self.remove_websocket(websocket)

    def _save_progress_state(self):
        """Persist progress state to MinIO."""
        try:
            if self.last_progress:
                bucket = bucket_manager.get_current_bucket()
                if bucket:
                    progress_data = {
                        "bucket_name": bucket.name,
                        "last_progress": self.last_progress
                    }
                    minio_service.put_json(bucket.name, "progress_state.json", progress_data)
        except Exception as e:
            print(f"Failed to save progress state: {e}")

    def _load_progress_state(self):
        """Load persisted progress state from MinIO."""
        try:
            bucket = bucket_manager.get_current_bucket()
            if bucket:
                progress_data = minio_service.get_json(bucket.name, "progress_state.json")
                if progress_data and progress_data.get("bucket_name") == bucket.name:
                    self.last_progress = progress_data.get("last_progress")
                    print(f"Loaded persisted progress for {bucket.name}")
        except Exception as e:
            print(f"Failed to load progress state: {e}")

    def on_progress(self, **kwargs):
        event_type = kwargs.get("type", "progress")

        # INTERCEPT COMPLETE EVENT to update stats
        if event_type == 'complete':
            files_total = kwargs.get('files_total', 0)
            embedding_dim = kwargs.get('embedding_dim')
            bucket = bucket_manager.get_current_bucket()
            if bucket:
                bucket_manager.update_stats(bucket.name, files_total)
                # Update embedding dimension if detected
                if embedding_dim and bucket.config:
                    bucket.config.embedding_dim = embedding_dim
                    bucket_manager._save_bucket_config(bucket)

        event_data = {
            "type": event_type,
            "data": kwargs,
            "timestamp": datetime.utcnow().isoformat()
        }
        self.last_progress = event_data
        self.progress_queue.put(event_data)

        # Persist progress state
        self._save_progress_state()

    def on_error(self, **kwargs):
        error_data = {
            "type": "error",
            "data": kwargs,
            "timestamp": datetime.utcnow().isoformat()
        }
        self.last_progress = error_data
        self.progress_queue.put(error_data)

    async def broadcast_progress(self):
        while True:
            try:
                if not self.progress_queue.empty():
                    event_data = self.progress_queue.get()
                    if self.websocket_clients:
                        # print(f"Broadcasting: {event_data['type']}", flush=True)
                        tasks = [self._send_to_websocket(ws, event_data) for ws in self.websocket_clients.copy()]
                        await asyncio.gather(*tasks, return_exceptions=True)
                await asyncio.sleep(0.1)
            except Exception as e:
                print(f"Error in broadcast_progress: {e}", flush=True)
                await asyncio.sleep(1)

    def start_indexing_bucket(self):
        print("DEBUG: Start indexing requested", flush=True)
        if self.is_running:
            print("DEBUG: Indexing already running", flush=True)
            raise ValueError("Indexing is already in progress")

        bucket = bucket_manager.get_current_bucket()
        if not bucket:
            print("DEBUG: No space selected", flush=True)
            raise ValueError("No space selected")
        
        # Force sync before check
        print(f"DEBUG: Syncing files for {bucket.name}", flush=True)
        bucket_manager.sync_bucket_files(bucket.name)
        
        if not bucket.directories:
            print(f"DEBUG: No files found in {bucket.name}/uploads/", flush=True)
            # Raise valid error but maybe UI needs to show it better
            raise ValueError("Current space has no files to index (uploads/ folder is empty)")

        print(f"DEBUG: Found {len(bucket.directories)} files. Starting thread.", flush=True)
        self.is_running = True
        self.last_progress = None

        def run_indexer():
            try:
                print("DEBUG: Indexer thread started", flush=True)
                # 1. Download files from MinIO to Cache
                # from services.minio_service import minio_service # Moved to top
                timestamp = int(datetime.utcnow().timestamp())
                # Use /tmp to avoid Windows/Docker volume locking issues
                cache_dir = f"/tmp/cache/{bucket.name}_{timestamp}"
                
                # No need to clean, it's new
                os.makedirs(cache_dir, exist_ok=True)
                
                self.on_progress(type='downloading', message='Downloading files from MinIO (uploads/)...')
                print(f"DEBUG: Downloading from {bucket.name} prefix='uploads/' to {cache_dir}", flush=True)
                
                # Download ONLY the 'uploads/' folder
                minio_service.download_bucket(bucket.name, cache_dir, prefix="uploads/")
                
                # The files will be in data/cache/<bucket>_<timestamp>/uploads/...
                # So we point the indexer to that subdirectory
                target_dir = os.path.join(cache_dir, "uploads")
                print(f"DEBUG: Target index dir: {target_dir}", flush=True)
                
                if not os.path.exists(target_dir):
                    print("DEBUG: Target dir does not exist even after download, creating (empty)", flush=True)
                    os.makedirs(target_dir, exist_ok=True) # Ensure it exists even if empty

                # 2. Configure Indexer point to Cache
                # Get settings from bucket config
                chunk_size = bucket.config.chunk_size if bucket.config else 1000
                embedding_model = bucket.config.embedding_model if bucket.config else "nomic-embed-text"
                embedding_dim = bucket.config.embedding_dim if bucket.config else None

                print("DEBUG: Initializing IndexerWithCallbacks", flush=True)
                indexer = IndexerWithCallbacks(
                    target_paths=[target_dir], # Point to cache/uploads
                    collection_name=bucket.name,
                    chunk_size=chunk_size,
                    embedding_model=embedding_model,
                    embedding_dim=embedding_dim,
                    progress_callback=self.on_progress,
                    error_callback=self.on_error
                )
                self.current_indexer = indexer

                # 3. Run Indexer
                print("DEBUG: Running indexer", flush=True)
                indexer.run()
                print("DEBUG: Indexer run complete", flush=True)
            except Exception as e:
                import traceback
                error_msg = traceback.format_exc()
                print(f"DEBUG: ERROR CAUGHT: {error_msg}", flush=True)
                # Write to file to bypass log truncation
                try:
                    with open("/app/error.log", "w") as f:
                        f.write(error_msg)
                except:
                    pass
                self.on_error(type='error', error='Indexing failed', message=f'Fatal error: {str(e)}')
            finally:
                self.is_running = False
                self.current_indexer = None
                print("DEBUG: Indexing finished/cleaned up", flush=True)

        thread = threading.Thread(target=run_indexer, daemon=True, name="IndexerThread")
        thread.start()

    def stop_indexing(self):
        if not self.is_running or not self.current_indexer:
            return False
        self.current_indexer.stop()
        return True

    def get_status(self) -> Dict[str, Any]:
        return {
            "is_running": self.is_running,
            "progress": self.last_progress.get("data") if self.last_progress else None,
            "connected_clients": len(self.websocket_clients)
        }

_manager_instance = None

def get_indexing_manager() -> IndexingManager:
    global _manager_instance
    if _manager_instance is None:
        _manager_instance = IndexingManager()
    return _manager_instance