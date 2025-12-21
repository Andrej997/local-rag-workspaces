"""
API routes for Bucket (Project) management.
"""
from fastapi import APIRouter, HTTPException
from typing import List
from models.schemas import Bucket, BucketConfig, CreateBucketRequest, AddDirectoryRequest, RemoveDirectoriesRequest
from services.bucket_manager import bucket_manager

router = APIRouter()

@router.get("/", response_model=List[Bucket])
async def get_buckets():
    """Get list of all buckets."""
    return bucket_manager.get_buckets()

@router.get("/current", response_model=Bucket)
async def get_current_bucket():
    """Get the currently selected bucket."""
    bucket = bucket_manager.get_current_bucket()
    if not bucket:
        raise HTTPException(status_code=404, detail="No bucket selected")
    return bucket

@router.post("/", response_model=Bucket)
async def create_bucket(request: CreateBucketRequest):
    """Create a new bucket and select it."""
    try:
        from services.minio_service import minio_service
        minio_service.ensure_bucket(request.name)
        
        return bucket_manager.create_bucket(request.name, request.config)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.put("/{name}/config", response_model=Bucket)
async def update_bucket_config(name: str, config: BucketConfig):
    """Update configuration for an existing bucket."""
    try:
        return bucket_manager.update_bucket_config(name, config)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.post("/{name}/select", response_model=Bucket)
async def select_bucket(name: str):
    """Switch the active bucket."""
    try:
        return bucket_manager.select_bucket(name)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.post("/{name}/directories", response_model=Bucket)
async def add_directory(name: str, request: AddDirectoryRequest):
    """Add a directory to a bucket."""
    try:
        return bucket_manager.add_directory(name, request.path)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.delete("/{name}/directories", response_model=Bucket)
async def remove_directories(name: str, request: RemoveDirectoriesRequest):
    """Remove multiple directories/files from a bucket."""
    return bucket_manager.remove_directories(name, request.paths)

@router.delete("/{name}")
async def delete_bucket(name: str):
    """Delete a bucket and all its contents."""
    try:
        return bucket_manager.delete_bucket(name)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))