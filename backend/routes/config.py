"""
Configuration management routes.
Handles reading and updating the selected project path.
"""
from fastapi import APIRouter, HTTPException, Query
from pathlib import Path

from models.schemas import ConfigResponse, ConfigUpdate, SuccessResponse
from services.path_manager import get_path_manager


router = APIRouter()


@router.get("/config", response_model=ConfigResponse)
async def get_config():
    """
    Get the currently selected project path.

    Returns:
        ConfigResponse with current directory (absolute path)
    """
    path_manager = get_path_manager()
    directory = path_manager.get_path()

    # Return empty string if no directory is set, instead of 404
    if directory is None:
        directory = ""

    return ConfigResponse(directory=directory)


@router.post("/config", response_model=SuccessResponse)
async def update_config(config: ConfigUpdate):
    """
    Update the selected project path.

    Args:
        config: New directory configuration (absolute path)

    Returns:
        Success message

    Raises:
        HTTPException: If directory doesn't exist or is invalid
    """
    directory_path = config.directory.strip()

    if not directory_path:
        raise HTTPException(status_code=400, detail="Directory path cannot be empty")

    full_path = Path(directory_path).resolve()

    if not full_path.exists():
        raise HTTPException(status_code=400, detail=f"Directory does not exist: {directory_path}")

    if not full_path.is_dir():
        raise HTTPException(status_code=400, detail=f"Path is not a directory: {directory_path}")

    # Store the absolute path
    path_manager = get_path_manager()
    path_manager.set_path(str(full_path))

    return SuccessResponse(
        message="Directory selected successfully",
        data={
            "directory": str(full_path),
            "absolute_path": str(full_path)
        }
    )


@router.delete("/config")
async def clear_config():
    """
    Clear the selected project path.

    Returns:
        Success message
    """
    path_manager = get_path_manager()
    path_manager.clear_path()

    return SuccessResponse(
        message="Directory selection cleared",
        data={}
    )
