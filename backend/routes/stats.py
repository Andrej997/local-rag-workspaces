from fastapi import APIRouter
from models.schemas import SystemStats
from services.bucket_manager import bucket_manager
from services.minio_service import minio_service
import os

router = APIRouter()

@router.get("/", response_model=SystemStats)
async def get_stats():
    buckets = bucket_manager.get_buckets()
    
    total_files = sum(b.file_count for b in buckets)
    total_dirs = sum(len(b.directories) for b in buckets)
    
    # Sort buckets by last_indexed to find latest activity
    sorted_by_date = sorted(
        [b for b in buckets if b.last_indexed], 
        key=lambda x: x.last_indexed, 
        reverse=True
    )
    last_activity = sorted_by_date[0].last_indexed if sorted_by_date else None

    space_stats = [
        {
            "name": b.name,
            "files": b.file_count,
            "directories": len(b.directories),
            "last_active": b.last_indexed
        }
        for b in buckets
    ]

    return SystemStats(
        total_spaces=len(buckets),
        total_files_indexed=total_files,
        total_directories=total_dirs,
        last_activity=last_activity,
        space_stats=space_stats
    )

@router.get("/space/{bucket_name}")
async def get_space_stats(bucket_name: str):
    """Get comprehensive statistics for a specific space."""
    try:
        stats = bucket_manager.get_space_stats(bucket_name)
        return stats
    except ValueError as e:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail=f"Error getting space stats: {str(e)}")

@router.get("/ollama/models")
async def get_ollama_models():
    """Get list of available Ollama models."""
    try:
        import ollama
        models_response = ollama.list()
        models = models_response.get('models', [])

        return {
            "models": [
                {
                    "name": model['name'],
                    "size": model.get('size', 0),
                    "modified": model.get('modified_at', '')
                }
                for model in models
            ],
            "count": len(models)
        }
    except Exception as e:
        return {
            "models": [],
            "count": 0,
            "error": str(e)
        }

@router.get("/health")
async def get_service_health():
    """Get health status of all services."""
    services = []

    # Backend service (always healthy if responding)
    services.append({
        "name": "Backend API",
        "status": "healthy",
        "message": "Service is running"
    })

    # MinIO service
    try:
        if minio_service.minio_client:
            minio_service.minio_client.list_buckets()
            services.append({
                "name": "MinIO",
                "status": "healthy",
                "message": "Connected to object storage"
            })
        else:
            services.append({
                "name": "MinIO",
                "status": "unhealthy",
                "message": "Not connected to object storage"
            })
    except Exception as e:
        services.append({
            "name": "MinIO",
            "status": "unhealthy",
            "message": f"Connection error: {str(e)}"
        })

    # Milvus service
    try:
        from pymilvus import connections, utility
        milvus_host = os.getenv("MILVUS_HOST", "localhost")
        milvus_port = os.getenv("MILVUS_PORT", "19530")

        try:
            connections.connect("health_check", host=milvus_host, port=milvus_port, timeout=2)
            collections = utility.list_collections(using="health_check")
            connections.disconnect("health_check")
            services.append({
                "name": "Milvus",
                "status": "healthy",
                "message": f"Connected ({len(collections)} collections)"
            })
        except Exception as e:
            services.append({
                "name": "Milvus",
                "status": "unhealthy",
                "message": f"Connection error: {str(e)}"
            })
    except ImportError:
        services.append({
            "name": "Milvus",
            "status": "unknown",
            "message": "Milvus library not available"
        })

    # Ollama service
    try:
        import ollama
        # Test if ollama is running by listing models
        ollama.list()
        services.append({
            "name": "Ollama",
            "status": "healthy",
            "message": "Embedding service available"
        })
    except Exception as e:
        services.append({
            "name": "Ollama",
            "status": "unhealthy",
            "message": f"Service not available: {str(e)}"
        })

    # Overall health
    all_healthy = all(s["status"] == "healthy" for s in services)

    return {
        "status": "healthy" if all_healthy else "degraded",
        "services": services
    }