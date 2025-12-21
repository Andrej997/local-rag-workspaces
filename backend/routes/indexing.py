"""
Indexing control routes and WebSocket endpoint.
"""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException

from models.schemas import IndexingStatusResponse, SuccessResponse
from services.indexing_manager import get_indexing_manager
from services.bucket_manager import bucket_manager

router = APIRouter()

@router.websocket("/ws/indexing")
async def websocket_endpoint(websocket: WebSocket):
    manager = get_indexing_manager()
    await websocket.accept()
    manager.add_websocket(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            if data == "stop":
                manager.stop_indexing()
                await websocket.send_json({
                    "type": "command_received",
                    "data": {"command": "stop"},
                    "timestamp": ""
                })
    except WebSocketDisconnect:
        manager.remove_websocket(websocket)
    except Exception as e:
        print(f"WebSocket error: {e}")
        manager.remove_websocket(websocket)


@router.post("/indexing/start", response_model=SuccessResponse)
async def start_indexing():
    """
    Start the indexing process for the current bucket.
    """
    manager = get_indexing_manager()
    bucket = bucket_manager.get_current_bucket()

    if not bucket:
        raise HTTPException(status_code=400, detail="No bucket selected.")

    if manager.is_running:
        raise HTTPException(status_code=400, detail="Indexing is already in progress")

    try:
        manager.start_indexing_bucket()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start indexing: {str(e)}")

    return SuccessResponse(
        message=f"Indexing started for bucket '{bucket.name}'",
        data={"bucket": bucket.name, "directories": bucket.directories}
    )


@router.post("/indexing/stop", response_model=SuccessResponse)
async def stop_indexing():
    manager = get_indexing_manager()
    if not manager.is_running:
        raise HTTPException(status_code=400, detail="No indexing process is currently running")
    
    success = manager.stop_indexing()
    if not success:
        raise HTTPException(status_code=500, detail="Failed to stop indexing")

    return SuccessResponse(message="Indexing stop signal sent", data={"status": "stopping"})


@router.get("/indexing/status", response_model=IndexingStatusResponse)
async def get_indexing_status():
    manager = get_indexing_manager()
    status = manager.get_status()
    bucket = bucket_manager.get_current_bucket()
    
    return IndexingStatusResponse(
        is_running=status["is_running"],
        progress=status["progress"],
        current_bucket=bucket.name if bucket else None
    )