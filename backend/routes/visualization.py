"""
API routes for Index Visualization.
Fetches vectors and performs dimensionality reduction (PCA).
"""
import os
import re
from fastapi import APIRouter, HTTPException, Query
from pymilvus import connections, Collection, utility

# Safe import for PCA
try:
    from sklearn.decomposition import PCA
except ImportError:
    PCA = None

router = APIRouter()

def get_collection_name(bucket_name: str) -> str:
    return re.sub(r'[^a-zA-Z0-9_]', '_', bucket_name)

@router.get("/visualization/{bucket_name}")
async def get_visualization_data(
    bucket_name: str, 
    dim: int = Query(2, ge=2, le=3, description="Dimensions (2 or 3)")
):
    """
    Retrieve all vectors from the bucket, apply PCA, and return 2D or 3D coordinates.
    """
    if PCA is None:
        raise HTTPException(
            status_code=500, 
            detail="Server missing 'scikit-learn'. Please run: docker-compose up -d --build backend"
        )

    # 1. Connect to Milvus
    try:
        milvus_host = os.getenv("MILVUS_HOST", "localhost")
        milvus_port = os.getenv("MILVUS_PORT", "19530")
        connections.connect("default", host=milvus_host, port=milvus_port)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database connection failed: {e}")

    collection_name = get_collection_name(bucket_name)

    # Check if collection exists at all
    if not utility.has_collection(collection_name):
        return {"points": [], "message": "Collection does not exist."}

    try:
        # 2. Fetch Vectors
        collection = Collection(collection_name)
        
        try:
            collection.load()
        except Exception as e:
            if "index not found" in str(e) or "code=700" in str(e):
                return {
                    "bucket": bucket_name, 
                    "points": [], 
                    "message": "Space has not been indexed yet. Please run indexing first."
                }
            raise e
        
        # Query for embeddings and metadata
        results = collection.query(
            expr="",  # Select all
            output_fields=["embedding", "filename", "content"],
            limit=2000
        )

        if not results:
            return {"points": []}

        # 3. Prepare Data for PCA
        embeddings = [r['embedding'] for r in results]
        
        # If fewer points than dimensions, cannot do PCA
        if len(embeddings) < dim:
             return {"points": []}

        # 4. Run PCA (Reduce to 2D or 3D)
        pca = PCA(n_components=dim)
        reduced_data = pca.fit_transform(embeddings)

        # 5. Format Response
        points = []
        for i, coord in enumerate(reduced_data):
            # Truncate content for display
            content_preview = results[i].get('content', '')[:100] + "..."
            
            point = {
                "x": float(coord[0]),
                "y": float(coord[1]),
                "filename": results[i].get('filename', 'unknown'),
                "content": content_preview
            }
            
            # Add Z coordinate if 3D
            if dim == 3:
                point["z"] = float(coord[2])
                
            points.append(point)

        return {
            "bucket": bucket_name,
            "dimensions": dim,
            "total_points": len(points),
            "points": points
        }

    except Exception as e:
        print(f"Visualization error: {e}")
        return {"points": [], "error": str(e)}