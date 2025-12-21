"""
Directory browsing routes.
"""
from fastapi import APIRouter, HTTPException, Query
from typing import Optional

from services.directory_browser import get_directory_browser
from models.schemas import SuccessResponse


router = APIRouter()


@router.get("/browse")
async def browse_directory(path: str = Query("", description="Absolute path to browse (empty for drives on Windows)")):
    """
    Browse a directory on the filesystem.

    Args:
        path: Absolute path to directory (empty to list drives on Windows, root on Unix)

    Returns:
        Directory contents with subdirectories and files

    Raises:
        HTTPException: If directory doesn't exist or cannot be accessed
    """
    browser = get_directory_browser()

    try:
        result = browser.list_directory(path)
        return result
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Directory not found: {path}")
    except NotADirectoryError:
        raise HTTPException(status_code=400, detail=f"Not a directory: {path}")
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error browsing directory: {str(e)}")


@router.get("/browse/info")
async def get_directory_info(path: str = Query(..., description="Absolute path to directory")):
    """
    Get information about a specific directory.

    Args:
        path: Absolute path to directory

    Returns:
        Directory metadata including file count

    Raises:
        HTTPException: If directory doesn't exist or cannot be accessed
    """
    browser = get_directory_browser()

    try:
        result = browser.get_directory_info(path)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Directory not found: {path}")
    except NotADirectoryError:
        raise HTTPException(status_code=400, detail=f"Not a directory: {path}")
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting directory info: {str(e)}")
