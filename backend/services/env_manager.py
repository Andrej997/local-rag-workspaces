"""
Environment file management module.
Handles safe reading and writing to .env file.
"""
from pathlib import Path
from typing import Dict, Optional


def get_env_path() -> Path:
    """Get the path to the .env file in the project root."""
    return Path(__file__).parent.parent.parent / '.env'


def read_env() -> Dict[str, str]:
    """
    Read and parse the .env file.

    Returns:
        Dictionary of environment variables
    """
    env_path = get_env_path()
    env_vars = {}

    if env_path.exists():
        with open(env_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                # Skip empty lines and comments
                if not line or line.startswith('#'):
                    continue

                # Parse key=value
                if '=' in line:
                    key, value = line.split('=', 1)
                    env_vars[key.strip()] = value.strip()

    return env_vars


def update_env(key: str, value: str) -> None:
    """
    Update or add a key-value pair in the .env file.
    Uses atomic file replacement for safety.

    Args:
        key: Environment variable name
        value: Environment variable value
    """
    env_path = get_env_path()

    # Read existing content
    lines = []
    if env_path.exists():
        with open(env_path, 'r', encoding='utf-8') as f:
            lines = f.readlines()

    # Update or append the key
    key_found = False
    for i, line in enumerate(lines):
        if line.strip().startswith(f"{key}="):
            lines[i] = f"{key}={value}\n"
            key_found = True
            break

    if not key_found:
        # Add new key
        if lines and not lines[-1].endswith('\n'):
            lines.append('\n')
        lines.append(f"{key}={value}\n")

    # Write atomically using temp file + rename
    temp_path = env_path.with_suffix('.env.tmp')
    with open(temp_path, 'w', encoding='utf-8') as f:
        f.writelines(lines)

    # Atomic replace (works on Windows and Unix)
    temp_path.replace(env_path)


def get_env_value(key: str) -> Optional[str]:
    """
    Get a specific environment variable value.

    Args:
        key: Environment variable name

    Returns:
        Value if found, None otherwise
    """
    env_vars = read_env()
    return env_vars.get(key)
