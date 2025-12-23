"""
Sanitization utilities for bucket names, collection names, and paths.
"""
import re
from pathlib import Path
from typing import Optional


def sanitize_bucket_name(bucket_name: str) -> str:
    """
    Sanitize bucket name to be compatible with MinIO.

    MinIO bucket names must:
    - Be 3-63 characters long
    - Contain only lowercase letters, numbers, dots, and hyphens
    - Start and end with a letter or number

    Args:
        bucket_name: Original bucket name

    Returns:
        Sanitized bucket name
    """
    # Convert to lowercase
    name = bucket_name.lower()

    # Replace invalid characters with hyphens
    name = re.sub(r'[^a-z0-9.-]', '-', name)

    # Remove consecutive hyphens
    name = re.sub(r'-+', '-', name)

    # Ensure starts and ends with alphanumeric
    name = name.strip('-.')

    # Ensure minimum length
    if len(name) < 3:
        name = name + '-bucket'

    # Ensure maximum length
    if len(name) > 63:
        name = name[:63].rstrip('-.')

    return name


def sanitize_collection_name(collection_name: str) -> str:
    """
    Sanitize collection name for Milvus.

    Milvus collection names must:
    - Contain only letters, numbers, and underscores
    - Start with a letter or underscore

    Args:
        collection_name: Original collection name

    Returns:
        Sanitized collection name
    """
    # Replace invalid characters with underscores
    name = re.sub(r'[^a-zA-Z0-9_]', '_', collection_name)

    # Ensure starts with letter or underscore
    if name and name[0].isdigit():
        name = '_' + name

    # Remove consecutive underscores
    name = re.sub(r'_+', '_', name)

    return name or '_default'


def sanitize_filename(filename: str) -> str:
    """
    Sanitize filename to prevent path traversal attacks.

    Removes:
    - Path traversal sequences (../, ..\)
    - Absolute path indicators (/, \, C:)
    - Null bytes
    - Leading/trailing whitespace and slashes

    Args:
        filename: Original filename

    Returns:
        Sanitized filename safe for file operations

    Raises:
        ValueError: If filename is empty or contains only invalid characters
    """
    if not filename:
        raise ValueError("Filename cannot be empty")

    # Remove null bytes
    filename = filename.replace('\0', '')

    # Convert to Path object and get parts to remove traversal
    try:
        # Use PureWindowsPath to handle both Windows and Unix paths
        parts = Path(filename).parts

        # Filter out dangerous parts
        safe_parts = []
        for part in parts:
            # Skip empty, current dir, parent dir, and drive letters
            if part in ('', '.', '..') or ':' in part:
                continue
            # Skip absolute path indicators
            if part.startswith('/') or part.startswith('\\'):
                continue
            safe_parts.append(part)

        if not safe_parts:
            raise ValueError("Filename contains only invalid path components")

        # Reconstruct path with forward slashes
        sanitized = '/'.join(safe_parts)

        # Final cleanup
        sanitized = sanitized.lstrip('/')

        return sanitized

    except Exception as e:
        raise ValueError(f"Invalid filename: {str(e)}")


def validate_object_key(object_key: str, allow_folders: bool = True) -> bool:
    """
    Validate MinIO object key for safety.

    Args:
        object_key: The object key to validate
        allow_folders: Whether to allow folder-like keys (with /)

    Returns:
        True if valid, False otherwise
    """
    if not object_key:
        return False

    # Check for dangerous patterns
    dangerous_patterns = [
        '..',      # Path traversal
        '\0',      # Null byte
        '\\',      # Windows path separator
    ]

    for pattern in dangerous_patterns:
        if pattern in object_key:
            return False

    # If folders not allowed, reject paths with /
    if not allow_folders and '/' in object_key:
        return False

    # Check for absolute paths
    if object_key.startswith('/'):
        return False

    return True
