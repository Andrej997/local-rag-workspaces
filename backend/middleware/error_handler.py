"""
Centralized Error Handling Middleware
Provides consistent error responses and logging across the application
"""
from fastapi import Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError, HTTPException
from starlette.exceptions import HTTPException as StarletteHTTPException
import traceback
from utils.logger import get_logger

logger = get_logger(__name__)


async def http_exception_handler(request: Request, exc: HTTPException):
    """Handle FastAPI HTTPException"""
    logger.warning(
        f"HTTP {exc.status_code} error on {request.method} {request.url.path}: {exc.detail}",
        extra={
            "method": request.method,
            "path": request.url.path,
            "status_code": exc.status_code
        }
    )

    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": exc.detail,
            "status_code": exc.status_code,
            "path": str(request.url.path)
        }
    )


async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Handle request validation errors (Pydantic validation)"""
    errors = exc.errors()
    logger.warning(
        f"Validation error on {request.method} {request.url.path}",
        extra={
            "method": request.method,
            "path": request.url.path,
            "errors": errors
        }
    )

    # Format validation errors for client
    formatted_errors = []
    for error in errors:
        formatted_errors.append({
            "field": " -> ".join(str(loc) for loc in error["loc"]),
            "message": error["msg"],
            "type": error["type"]
        })

    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "error": "Validation error",
            "status_code": 422,
            "path": str(request.url.path),
            "details": formatted_errors
        }
    )


async def generic_exception_handler(request: Request, exc: Exception):
    """Handle all unhandled exceptions"""
    # Log the full traceback for debugging
    logger.error(
        f"Unhandled exception on {request.method} {request.url.path}: {str(exc)}",
        exc_info=True,
        extra={
            "method": request.method,
            "path": request.url.path,
            "exception_type": type(exc).__name__
        }
    )

    # In production, don't expose internal error details
    # For now, include some details for debugging
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": "Internal server error",
            "status_code": 500,
            "path": str(request.url.path),
            "message": str(exc),  # Consider removing in production
            "type": type(exc).__name__
        }
    )


def register_exception_handlers(app):
    """Register all exception handlers with the FastAPI app"""
    app.add_exception_handler(HTTPException, http_exception_handler)
    app.add_exception_handler(StarletteHTTPException, http_exception_handler)
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(Exception, generic_exception_handler)

    logger.info("Exception handlers registered successfully")
