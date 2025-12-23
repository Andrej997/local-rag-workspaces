"""
API routes for web scraping functionality.
Allows users to scrape web pages and convert them to PDFs.
"""
import re
import base64
import json
import logging
from datetime import datetime
from urllib.parse import urlparse
from typing import Optional

from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel

logger = logging.getLogger(__name__)
router = APIRouter()


class ScrapeRequest(BaseModel):
    """Request model for scraping a URL."""
    url: str
    bucket_name: str  # Target bucket for saving


class ScrapeResponse(BaseModel):
    """Response model for scraping a URL."""
    message: str
    url: str
    bucket_name: str
    status: str  # "started"


class SaveRequest(BaseModel):
    """Request model for saving scraped PDF."""
    bucket_name: str
    url: str
    pdf_data: str  # base64 encoded PDF


class SaveResponse(BaseModel):
    """Response model for saving scraped PDF."""
    message: str
    file_path: str


def _generate_filename(url: str) -> str:
    """
    Generate a safe filename from URL.

    Args:
        url: The URL to generate filename from

    Returns:
        Sanitized filename
    """
    parsed = urlparse(url)

    # Get domain without www.
    domain = parsed.hostname or 'unknown'
    domain = domain.replace('www.', '')

    # Sanitize domain
    domain = re.sub(r'[^a-zA-Z0-9-]', '-', domain)

    # Add path if present (truncate to avoid overly long names)
    if parsed.path and parsed.path != '/':
        path_safe = re.sub(r'[^a-zA-Z0-9-]', '-', parsed.path[:50])
        path_safe = path_safe.strip('-')
        if path_safe:
            domain = f"{domain}_{path_safe}"

    # Add timestamp
    timestamp = datetime.now().strftime('%Y%m%d-%H%M%S')

    return f"scraped_{domain}_{timestamp}.pdf"


async def _background_scrape_and_save(url: str, bucket_name: str):
    """
    Background task to scrape URL and save to storage.

    Args:
        url: The URL to scrape
        bucket_name: Target bucket name
    """
    try:
        from services.scraper_service import get_scraper_service
        from services.minio_service import minio_service
        from services.bucket_manager import bucket_manager

        logger.info(f"Background scraping started for {url}")

        scraper = get_scraper_service()

        # Scrape URL and get PDF bytes
        pdf_bytes = await scraper.scrape_url(url)
        logger.info(f"Scraping completed: {len(pdf_bytes)} bytes")

        # Generate filename
        filename = _generate_filename(url)

        # Object path in MinIO - store in uploads/scraped/ subpath
        object_key = f"uploads/scraped/{filename}"

        # Ensure bucket exists
        minio_service.ensure_bucket(bucket_name)

        # Upload to MinIO
        minio_service.upload_stream(
            bucket_name=bucket_name,
            object_name=object_key,
            data=pdf_bytes,
            length=len(pdf_bytes)
        )
        logger.info(f"Uploaded scraped PDF to {bucket_name}/{object_key}")

        # Sync bucket files to update metadata
        try:
            bucket_manager.sync_bucket_files(bucket_name)
        except Exception as e:
            # Log but don't fail - the file is already uploaded
            logger.warning(f"Failed to sync bucket files: {str(e)}")

        logger.info(f"Background scraping completed successfully for {url}")

    except Exception as e:
        logger.error(f"Background scraping failed for {url}: {str(e)}")

        # Save error details to bucket error folder
        try:
            from services.minio_service import minio_service

            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            error_filename = f"error_{timestamp}.json"
            error_key = f"error/{error_filename}"

            error_data = {
                "timestamp": datetime.now().isoformat(),
                "url": url,
                "error_type": type(e).__name__,
                "error_message": str(e),
                "bucket_name": bucket_name
            }

            error_json = json.dumps(error_data, indent=2)
            error_bytes = error_json.encode('utf-8')

            # Ensure bucket exists
            minio_service.ensure_bucket(bucket_name)

            # Upload error log to MinIO
            minio_service.upload_stream(
                bucket_name=bucket_name,
                object_name=error_key,
                data=error_bytes,
                length=len(error_bytes)
            )
            logger.info(f"Error details saved to {bucket_name}/{error_key}")

        except Exception as error_save_exception:
            logger.error(f"Failed to save error details: {str(error_save_exception)}")


@router.post("/scrape", response_model=ScrapeResponse)
async def scrape_url(request: ScrapeRequest, background_tasks: BackgroundTasks):
    """
    Trigger background scraping of a URL and save to storage.

    The scraping happens in the background, so this endpoint returns immediately.

    On success: PDF saved to {bucket}/uploads/scraped/{filename}
    On failure: Error details saved to {bucket}/error/error_{timestamp}.json

    Args:
        request: ScrapeRequest containing the URL and bucket name
        background_tasks: FastAPI background tasks

    Returns:
        ScrapeResponse indicating the task has started

    Raises:
        HTTPException: For validation errors
    """
    try:
        from services.scraper_service import get_scraper_service

        # Validate URL before starting background task
        scraper = get_scraper_service()
        is_valid, error_msg = scraper.validate_url(request.url)
        if not is_valid:
            raise HTTPException(status_code=400, detail=error_msg)

        # Start background task
        background_tasks.add_task(_background_scrape_and_save, request.url, request.bucket_name)

        logger.info(f"Background scraping task queued for {request.url}")

        return ScrapeResponse(
            message=f"Scraping started in background. If successful, the file will be saved to {request.bucket_name}/uploads/scraped/. If there is an error, details will be saved to {request.bucket_name}/error/",
            url=request.url,
            bucket_name=request.bucket_name,
            status="started"
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error starting scrape task: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to start scraping: {str(e)}")


@router.post("/save", response_model=SaveResponse)
async def save_scraped_pdf(request: SaveRequest):
    """
    Save a scraped PDF to MinIO object storage.

    Args:
        request: SaveRequest containing bucket name, URL, and PDF data

    Returns:
        SaveResponse with success message and file path

    Raises:
        HTTPException: If save fails
    """
    try:
        from services.minio_service import minio_service
        from services.bucket_manager import bucket_manager

        # Decode base64 PDF
        try:
            pdf_bytes = base64.b64decode(request.pdf_data)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid PDF data: {str(e)}")

        # Generate filename
        filename = _generate_filename(request.url)

        # Object path in MinIO
        object_key = f"uploads/scraped/{filename}"

        # Ensure bucket exists
        minio_service.ensure_bucket(request.bucket_name)

        # Upload to MinIO
        try:
            minio_service.upload_stream(
                bucket_name=request.bucket_name,
                object_name=object_key,
                data=pdf_bytes,
                length=len(pdf_bytes)
            )
            logger.info(f"Uploaded scraped PDF to {request.bucket_name}/{object_key}")
        except Exception as e:
            logger.error(f"MinIO upload error: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Failed to upload to storage: {str(e)}")

        # Sync bucket files to update metadata
        try:
            bucket_manager.sync_bucket_files(request.bucket_name)
        except Exception as e:
            # Log but don't fail - the file is already uploaded
            logger.warning(f"Failed to sync bucket files: {str(e)}")

        return SaveResponse(
            message=f"Successfully saved scraped PDF: {filename}",
            file_path=object_key
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in save endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
