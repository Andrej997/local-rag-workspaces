"""
Validation utilities for URLs, file paths, and user input.
"""
import re
import ipaddress
from urllib.parse import urlparse
from typing import Tuple, Optional


def is_private_ip(hostname: str) -> bool:
    """
    Check if hostname resolves to a private IP address.

    Args:
        hostname: The hostname or IP address to check

    Returns:
        True if private, False otherwise
    """
    try:
        ip = ipaddress.ip_address(hostname)
        return ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved
    except ValueError:
        # Not a valid IP address, might be a hostname
        return False


def validate_url(url: str, allow_private: bool = False) -> Tuple[bool, Optional[str]]:
    """
    Validate URL for security (SSRF prevention).

    Args:
        url: The URL to validate
        allow_private: Whether to allow private IP addresses (default: False)

    Returns:
        Tuple of (is_valid, error_message)
    """
    # Check if URL starts with http:// or https://
    if not re.match(r'^https?://', url, re.IGNORECASE):
        return False, "URL must start with http:// or https://"

    try:
        parsed = urlparse(url)

        # Check if hostname exists
        if not parsed.hostname:
            return False, "Invalid URL format - missing hostname"

        hostname_lower = parsed.hostname.lower()

        # Block localhost and loopback addresses
        localhost_names = [
            'localhost',
            'localhost.localdomain',
            'localhost6',
            'localhost6.localdomain6',
        ]

        if hostname_lower in localhost_names:
            return False, "Cannot access localhost addresses"

        # Check if it's an IP address
        try:
            ip = ipaddress.ip_address(hostname_lower)

            if not allow_private:
                # Block private, loopback, link-local, and reserved IPs
                if ip.is_private:
                    return False, "Cannot access private IP addresses"
                if ip.is_loopback:
                    return False, "Cannot access loopback addresses"
                if ip.is_link_local:
                    return False, "Cannot access link-local addresses"
                if ip.is_reserved:
                    return False, "Cannot access reserved IP addresses"
                if ip.is_multicast:
                    return False, "Cannot access multicast addresses"

        except ValueError:
            # Not an IP address, it's a hostname
            # Check for localhost-like patterns
            if 'localhost' in hostname_lower or hostname_lower.startswith('127.'):
                return False, "Cannot access localhost-like addresses"

        # Validate port if present
        if parsed.port:
            if parsed.port < 1 or parsed.port > 65535:
                return False, f"Invalid port number: {parsed.port}"

            # Optionally block dangerous ports
            dangerous_ports = [22, 23, 25, 3389]  # SSH, Telnet, SMTP, RDP
            if parsed.port in dangerous_ports:
                return False, f"Port {parsed.port} is not allowed"

        return True, None

    except Exception as e:
        return False, f"Invalid URL: {str(e)}"


def validate_file_size(size_bytes: int, max_size_mb: int = 100) -> Tuple[bool, Optional[str]]:
    """
    Validate file size.

    Args:
        size_bytes: File size in bytes
        max_size_mb: Maximum allowed size in MB

    Returns:
        Tuple of (is_valid, error_message)
    """
    max_bytes = max_size_mb * 1024 * 1024

    if size_bytes > max_bytes:
        return False, f"File size ({size_bytes / 1024 / 1024:.2f}MB) exceeds maximum allowed size ({max_size_mb}MB)"

    if size_bytes <= 0:
        return False, "File size must be greater than 0"

    return True, None


def validate_bucket_name(name: str) -> Tuple[bool, Optional[str]]:
    """
    Validate bucket name format.

    Args:
        name: The bucket name to validate

    Returns:
        Tuple of (is_valid, error_message)
    """
    if not name:
        return False, "Bucket name cannot be empty"

    if len(name) < 3:
        return False, "Bucket name must be at least 3 characters"

    if len(name) > 63:
        return False, "Bucket name must be at most 63 characters"

    # Check for valid characters (after sanitization, should be lowercase alphanumeric, dots, hyphens)
    if not re.match(r'^[a-z0-9][a-z0-9.-]*[a-z0-9]$', name):
        return False, "Bucket name contains invalid characters"

    # Check for consecutive periods or hyphens
    if '..' in name or '--' in name:
        return False, "Bucket name cannot contain consecutive periods or hyphens"

    return True, None


def validate_chunk_size(chunk_size: int) -> Tuple[bool, Optional[str]]:
    """
    Validate chunk size for document indexing.

    Args:
        chunk_size: The chunk size to validate

    Returns:
        Tuple of (is_valid, error_message)
    """
    min_size = 100
    max_size = 5000

    if chunk_size < min_size:
        return False, f"Chunk size must be at least {min_size} characters"

    if chunk_size > max_size:
        return False, f"Chunk size must be at most {max_size} characters"

    return True, None


def validate_temperature(temperature: float) -> Tuple[bool, Optional[str]]:
    """
    Validate LLM temperature parameter.

    Args:
        temperature: The temperature value to validate

    Returns:
        Tuple of (is_valid, error_message)
    """
    if temperature < 0.0:
        return False, "Temperature must be at least 0.0"

    if temperature > 2.0:
        return False, "Temperature must be at most 2.0"

    return True, None
