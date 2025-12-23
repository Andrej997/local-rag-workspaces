"""
API routes for Bucket (Project) management.
"""
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from typing import List
from models.schemas import Bucket, BucketConfig, CreateBucketRequest, AddDirectoryRequest, AddDirectoriesRequest, RemoveDirectoriesRequest
from services.bucket_manager import bucket_manager
from services.minio_service import minio_service
from utils.logger import get_logger
from utils.sanitizers import sanitize_filename, validate_object_key
import io

logger = get_logger(__name__)

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

@router.put("/{name}/directories", response_model=Bucket)
async def add_directories(name: str, request: AddDirectoriesRequest):
    """Add multiple directories/files to a bucket."""
    try:
        return bucket_manager.add_directories(name, request.paths)
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

@router.get("/{bucket_name}/files/{file_path:path}")
async def get_file(bucket_name: str, file_path: str):
    """Download/view a file from MinIO bucket."""
    try:
        if not minio_service.minio_client:
            logger.error("MinIO service not available")
            raise HTTPException(status_code=500, detail="MinIO service not available")

        # Sanitize and validate file path to prevent path traversal
        try:
            sanitized_path = sanitize_filename(file_path)
        except ValueError as e:
            logger.warning(f"Invalid file path attempted: {file_path} - {str(e)}")
            raise HTTPException(status_code=400, detail=f"Invalid file path: {str(e)}")

        # Additional validation
        if not validate_object_key(sanitized_path):
            logger.warning(f"Unsafe object key detected: {sanitized_path}")
            raise HTTPException(status_code=400, detail="Invalid file path")

        safe_bucket_name = minio_service._sanitize_bucket_name(bucket_name)

        # Get the file from MinIO
        logger.info(f"Fetching file '{sanitized_path}' from bucket '{safe_bucket_name}'")
        response = minio_service.minio_client.get_object(safe_bucket_name, sanitized_path)

        # Read the content
        content = response.read()
        response.close()

        # Determine content type based on file extension
        content_type = "application/octet-stream"
        if sanitized_path.endswith('.pdf'):
            content_type = "application/pdf"
        elif sanitized_path.endswith(('.txt', '.md')):
            content_type = "text/plain"
        elif sanitized_path.endswith(('.jpg', '.jpeg')):
            content_type = "image/jpeg"
        elif sanitized_path.endswith('.png'):
            content_type = "image/png"
        elif sanitized_path.endswith('.json'):
            content_type = "application/json"
        elif sanitized_path.endswith(('.py', '.js', '.jsx', '.ts', '.tsx', '.html', '.css')):
            content_type = "text/plain"

        # Extract filename safely
        filename = sanitized_path.split('/')[-1]

        # Return as streaming response
        return StreamingResponse(
            io.BytesIO(content),
            media_type=content_type,
            headers={
                "Content-Disposition": f"inline; filename={filename}"
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching file '{file_path}' from bucket '{bucket_name}': {str(e)}")
        raise HTTPException(status_code=404, detail=f"File not found: {str(e)}")