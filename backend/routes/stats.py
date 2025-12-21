from fastapi import APIRouter
from models.schemas import SystemStats
from services.bucket_manager import bucket_manager

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