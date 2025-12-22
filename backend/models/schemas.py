"""
Pydantic models for API request and response validation.
"""
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from datetime import datetime


class ConfigResponse(BaseModel):
    directory: str = Field(..., description="Current PROJECT_PATH directory")


class ConfigUpdate(BaseModel):
    directory: str = Field(..., description="New PROJECT_PATH directory", min_length=1)


class IndexingStatusResponse(BaseModel):
    is_running: bool = Field(..., description="Whether indexing is currently running")
    progress: Optional[Dict[str, Any]] = Field(None, description="Current progress data if running")
    current_bucket: Optional[str] = Field(None, description="Name of the bucket currently being indexed")


class ProgressEvent(BaseModel):
    type: str = Field(..., description="Event type")
    data: Dict[str, Any] = Field(default_factory=dict, description="Event-specific data")
    timestamp: str = Field(default_factory=lambda: datetime.utcnow().isoformat(), description="ISO timestamp")


class ErrorResponse(BaseModel):
    error: str = Field(..., description="Error message")
    detail: Optional[str] = Field(None, description="Detailed error information")


class SuccessResponse(BaseModel):
    message: str = Field(..., description="Success message")
    data: Optional[Dict[str, Any]] = Field(None, description="Optional response data")


# --- Bucket Models ---

class FileMetadata(BaseModel):
    """Metadata for a file in MinIO."""
    path: str = Field(..., description="Full path to the file in MinIO")
    size: int = Field(..., description="File size in bytes")
    last_modified: datetime = Field(..., description="When the file was last modified/uploaded")

class BucketConfig(BaseModel):
    """Configuration settings for a specific space."""
    chunk_size: int = Field(default=1000, ge=100, le=5000, description="Character count per text chunk")
    llm_model: str = Field(default="llama3.2", description="Ollama model to use for chat")
    temperature: float = Field(default=0.7, ge=0.0, le=1.0, description="LLM temperature")
    embedding_model: str = Field(default="nomic-embed-text", description="Ollama embedding model to use")
    embedding_dim: int = Field(default=768, description="Embedding vector dimension (auto-detected)")

class Bucket(BaseModel):
    """Model representing a project space."""
    name: str = Field(..., description="Unique name of the space")
    directories: List[str] = Field(default_factory=list, description="List of directories included (legacy)")
    files: List[FileMetadata] = Field(default_factory=list, description="List of files with metadata")
    config: BucketConfig = Field(default_factory=BucketConfig, description="Space configuration")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    last_indexed: Optional[datetime] = None
    file_count: int = Field(default=0, description="Number of files indexed")


class CreateBucketRequest(BaseModel):
    name: str = Field(..., min_length=1)
    config: Optional[BucketConfig] = None


class AddDirectoryRequest(BaseModel):
    path: str = Field(..., min_length=1)


class AddDirectoriesRequest(BaseModel):
    paths: List[str] = Field(..., min_items=1)


class RemoveDirectoriesRequest(BaseModel):
    paths: List[str] = Field(..., min_items=1)

# --- Stats Models ---

class SystemStats(BaseModel):
    total_spaces: int
    total_files_indexed: int
    total_directories: int
    last_activity: Optional[datetime]
    space_stats: List[Dict[str, Any]]