"""
Path manager for storing selected directory (persisted to .env file).
"""
import os
from typing import Optional
from .env_manager import get_env_value, update_env


class PathManager:
    """Manages the currently selected project path with persistence."""

    def __init__(self):
        # Load from .env on initialization
        path = get_env_value("PROJECT_PATH")
        
        # DEFAULT TO /workspace if not set
        # This corresponds to the volume mount in docker-compose.yml
        if not path:
            path = "/workspace"
            # Optional: Persist this default immediately
            update_env("PROJECT_PATH", path)
            
        self._selected_path: Optional[str] = path

    def set_path(self, path: str) -> None:
        """
        Set the selected project path and persist to .env file.

        Args:
            path: Absolute path to directory
        """
        self._selected_path = path
        # Persist to .env file
        update_env("PROJECT_PATH", path)

    def get_path(self) -> Optional[str]:
        """
        Get the currently selected project path.

        Returns:
            Absolute path or None if not set
        """
        return self._selected_path

    def get_absolute_path(self) -> Optional[str]:
        """
        Get the absolute path for indexing.

        Returns:
            Absolute path or None if not set
        """
        return self._selected_path

    def clear_path(self) -> None:
        """Clear the selected path and remove from .env file."""
        self._selected_path = None
        # Clear from .env file by setting to empty string
        update_env("PROJECT_PATH", "")

    def is_set(self) -> bool:
        """Check if a path is currently set."""
        return self._selected_path is not None


# Singleton instance
_path_manager: Optional[PathManager] = None


def get_path_manager() -> PathManager:
    """Get the singleton path manager instance."""
    global _path_manager
    if _path_manager is None:
        _path_manager = PathManager()
    return _path_manager