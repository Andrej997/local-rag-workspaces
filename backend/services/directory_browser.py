"""
Directory browser service for navigating the filesystem.
"""
import os
from pathlib import Path
from typing import List, Dict, Optional


class DirectoryBrowser:
    """Service for browsing directories on the filesystem."""

    def __init__(self):
        """Initialize directory browser."""
        pass

    def list_directory(self, directory_path: str = "") -> Dict:
        """
        List contents of a directory.

        Args:
            directory_path: Absolute path to directory, or empty for drives on Windows

        Returns:
            Dictionary containing directories and files

        Raises:
            FileNotFoundError: If directory doesn't exist
            PermissionError: If directory cannot be accessed
        """
        # Handle empty path (list drives on Windows, root on Unix)
        if not directory_path:
            if os.name == 'nt':  # Windows
                # List available drives
                import string
                drives = []
                for letter in string.ascii_uppercase:
                    drive = f"{letter}:\\"
                    if os.path.exists(drive):
                        drives.append({
                            "name": drive,
                            "path": drive,
                            "type": "directory"
                        })
                return {
                    "current_path": "",
                    "absolute_path": "",
                    "directories": drives,
                    "files": [],
                    "parent": None
                }
            else:  # Unix-like
                directory_path = "/"

        full_path = Path(directory_path).resolve()

        if not full_path.exists():
            raise FileNotFoundError(f"Directory not found: {directory_path}")

        if not full_path.is_dir():
            raise NotADirectoryError(f"Not a directory: {directory_path}")

        # List directory contents
        directories = []
        files = []

        try:
            for item in sorted(full_path.iterdir()):
                # Skip hidden files and common ignore patterns
                if item.name.startswith('.'):
                    continue
                if item.name in {'node_modules', '__pycache__', 'venv', '.git'}:
                    continue

                if item.is_dir():
                    directories.append({
                        "name": item.name,
                        "path": str(item),
                        "type": "directory"
                    })
                else:
                    files.append({
                        "name": item.name,
                        "path": str(item),
                        "type": "file",
                        "size": item.stat().st_size
                    })
        except PermissionError:
            raise PermissionError(f"Permission denied: Cannot read directory")

        # Determine parent path
        parent = None
        if full_path.parent != full_path:
            parent = str(full_path.parent)
        elif os.name == 'nt':  # At drive root on Windows, go back to drive list
            parent = ""

        return {
            "current_path": str(full_path),
            "absolute_path": str(full_path),
            "directories": directories,
            "files": files,
            "parent": parent
        }

    def get_directory_info(self, directory_path: str) -> Dict:
        """
        Get information about a specific directory.

        Args:
            directory_path: Absolute path to directory

        Returns:
            Dictionary with directory metadata
        """
        if not directory_path:
            raise ValueError("Directory path cannot be empty")

        full_path = Path(directory_path).resolve()

        if not full_path.exists():
            raise FileNotFoundError(f"Directory not found: {directory_path}")

        if not full_path.is_dir():
            raise NotADirectoryError(f"Not a directory: {directory_path}")

        # Count indexable files recursively
        file_count = 0
        ignore_dirs = {'.git', 'venv', '__pycache__', 'node_modules'}

        for item in full_path.rglob('*'):
            if item.is_file():
                # Check if any parent is in ignore list
                if not any(part in ignore_dirs for part in item.parts):
                    file_count += 1

        return {
            "path": str(full_path),
            "absolute_path": str(full_path),
            "name": full_path.name or full_path.drive or "root",
            "indexable_files": file_count,
            "exists": True
        }


# Singleton instance
_browser_instance: Optional[DirectoryBrowser] = None


def get_directory_browser() -> DirectoryBrowser:
    """Get the singleton directory browser instance."""
    global _browser_instance
    if _browser_instance is None:
        _browser_instance = DirectoryBrowser()
    return _browser_instance
