"""
API routes for file uploads.
Allows users to upload local files/folders to be indexed.
"""
import os
import shutil
from typing import List
from fastapi import APIRouter, UploadFile, File, HTTPException
from services.file_types import is_supported_file

router = APIRouter()

@router.post("/{bucket_name}")
async def upload_files(bucket_name: str, files: List[UploadFile] = File(...)):
    """
    Upload files/folders to be indexed.
    Uploads directly to MinIO bucket '{bucket_name}' for persistence.
    """
    try:
        from services.bucket_manager import bucket_manager
        from services.minio_service import minio_service

        minio_service.ensure_bucket(bucket_name)

        saved_count = 0
        skipped_count = 0
        skipped_files = []

        for file in files:
            try:
                # Sanitize filename (remove leading slashes)
                # Frontend sends 'folder/file.txt' for directory uploads
                filename = file.filename.lstrip('/')

                # Skip unsupported file types
                if not is_supported_file(filename):
                    skipped_count += 1
                    skipped_files.append(filename)
                    print(f"Skipping unsupported file: {filename}")
                    continue

                # Read content once - stream to RAM for upload
                # (For very large files, might want to use SpooledTemporaryFile but
                # UploadFile is already spooled. We read into memory for simple upload_stream)
                content = await file.read()

                # Upload to MinIO
                # Store in 'uploads/' folder
                object_key = f"uploads/{filename}"

                minio_service.upload_stream(
                    bucket_name=bucket_name,
                    object_name=object_key,
                    data=content,
                    length=len(content)
                )

                saved_count += 1
            except Exception as e:
                print(f"Error processing {file.filename}: {e}")
                continue
            finally:
                await file.close()

        # Sync bucket state from MinIO
        try:
            bucket_manager.sync_bucket_files(bucket_name)
        except Exception as e:
            print(f"Failed to sync bucket: {e}")

        message = f"Successfully uploaded {saved_count} file(s) to MinIO"
        if skipped_count > 0:
            message += f". Skipped {skipped_count} unsupported file(s)"

        return {
            "message": message,
            "uploaded": saved_count,
            "skipped": skipped_count,
            "skipped_files": skipped_files[:10] if len(skipped_files) > 10 else skipped_files  # Limit to 10 for response size
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")