"""
API routes for file uploads.
Allows users to upload local files/folders to be indexed.
"""
import os
import shutil
from typing import List
from fastapi import APIRouter, UploadFile, File, HTTPException
from services.file_types import is_supported_file
from utils.logger import get_logger
from utils.sanitizers import sanitize_filename
from utils.validators import validate_file_size

logger = get_logger(__name__)
router = APIRouter()

# Configuration
MAX_FILE_SIZE_MB = 100  # Maximum file size in MB
MAX_TOTAL_SIZE_MB = 500  # Maximum total upload size in MB

@router.post("/{bucket_name}")
async def upload_files(bucket_name: str, files: List[UploadFile] = File(...)):
    """
    Upload files/folders to be indexed.
    Uploads directly to MinIO bucket '{bucket_name}' for persistence.

    Limits:
    - Maximum file size: 100MB per file
    - Maximum total upload size: 500MB per request
    """
    try:
        from services.bucket_manager import bucket_manager
        from services.minio_service import minio_service

        if not files:
            raise HTTPException(status_code=400, detail="No files provided")

        logger.info(f"Starting upload of {len(files)} file(s) to bucket '{bucket_name}'")
        minio_service.ensure_bucket(bucket_name)

        saved_count = 0
        skipped_count = 0
        skipped_files = []
        total_size = 0

        for file in files:
            try:
                # Sanitize filename to prevent path traversal
                try:
                    sanitized_filename = sanitize_filename(file.filename)
                except ValueError as e:
                    logger.warning(f"Invalid filename '{file.filename}': {str(e)}")
                    skipped_count += 1
                    skipped_files.append(f"{file.filename} (invalid path)")
                    continue

                # Skip unsupported file types
                if not is_supported_file(sanitized_filename):
                    skipped_count += 1
                    skipped_files.append(f"{sanitized_filename} (unsupported type)")
                    logger.debug(f"Skipping unsupported file: {sanitized_filename}")
                    continue

                # Read content
                content = await file.read()
                file_size = len(content)

                # Validate individual file size
                is_valid, error_msg = validate_file_size(file_size, MAX_FILE_SIZE_MB)
                if not is_valid:
                    logger.warning(f"File '{sanitized_filename}' rejected: {error_msg}")
                    skipped_count += 1
                    skipped_files.append(f"{sanitized_filename} (too large)")
                    continue

                # Check total upload size
                total_size += file_size
                max_total_bytes = MAX_TOTAL_SIZE_MB * 1024 * 1024
                if total_size > max_total_bytes:
                    logger.warning(f"Total upload size exceeded: {total_size / 1024 / 1024:.2f}MB > {MAX_TOTAL_SIZE_MB}MB")
                    raise HTTPException(
                        status_code=413,
                        detail=f"Total upload size ({total_size / 1024 / 1024:.2f}MB) exceeds maximum allowed ({MAX_TOTAL_SIZE_MB}MB)"
                    )

                # Upload to MinIO (store in 'uploads/' folder)
                object_key = f"uploads/{sanitized_filename}"

                minio_service.upload_stream(
                    bucket_name=bucket_name,
                    object_name=object_key,
                    data=content,
                    length=file_size
                )

                saved_count += 1
                logger.debug(f"Uploaded '{sanitized_filename}' ({file_size / 1024:.2f}KB)")

            except HTTPException:
                raise
            except Exception as e:
                logger.error(f"Error processing file '{file.filename}': {str(e)}")
                skipped_count += 1
                skipped_files.append(f"{file.filename} (error: {str(e)[:50]})")
                continue
            finally:
                await file.close()

        # Sync bucket state from MinIO
        try:
            bucket_manager.sync_bucket_files(bucket_name)
        except Exception as e:
            logger.error(f"Failed to sync bucket '{bucket_name}': {str(e)}")

        message = f"Successfully uploaded {saved_count} file(s) ({total_size / 1024 / 1024:.2f}MB total)"
        if skipped_count > 0:
            message += f". Skipped {skipped_count} file(s)"

        logger.info(f"Upload complete: {saved_count} uploaded, {skipped_count} skipped")

        return {
            "message": message,
            "uploaded": saved_count,
            "skipped": skipped_count,
            "total_size_mb": round(total_size / 1024 / 1024, 2),
            "skipped_files": skipped_files[:10] if len(skipped_files) > 10 else skipped_files
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Upload failed for bucket '{bucket_name}': {str(e)}")
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")