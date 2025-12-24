"""
API routes for Index Visualization.
Fetches vectors and performs dimensionality reduction (PCA).
Includes semantic clustering and similarity graph features.
"""
import os
import re
import numpy as np
import ollama
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Query, Body
from pydantic import BaseModel
from pymilvus import connections, Collection, utility

# Safe import for sklearn
try:
    from sklearn.decomposition import PCA
    from sklearn.cluster import KMeans
    from sklearn.metrics.pairwise import cosine_similarity
except ImportError:
    PCA = None
    KMeans = None
    cosine_similarity = None

router = APIRouter()

class QueryProjectionRequest(BaseModel):
    query: str
    dim: int = 2

def get_collection_name(bucket_name: str) -> str:
    return re.sub(r'[^a-zA-Z0-9_]', '_', bucket_name)

@router.get("/visualization/{bucket_name}")
async def get_visualization_data(
    bucket_name: str,
    dim: int = Query(2, ge=2, le=3, description="Dimensions (2 or 3)"),
    use_clustering: bool = Query(False, description="Apply semantic clustering"),
    n_clusters: int = Query(8, ge=2, le=20, description="Number of clusters for semantic grouping")
):
    """
    Retrieve all vectors from the bucket, apply PCA, and return 2D or 3D coordinates.
    Optionally includes semantic clustering.
    """
    if PCA is None or KMeans is None:
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
        embeddings = np.array([r['embedding'] for r in results])

        # If fewer points than dimensions, cannot do PCA
        if len(embeddings) < dim:
             return {"points": []}

        # 4. Apply Semantic Clustering (Optional)
        clusters = None
        if use_clustering and len(embeddings) >= n_clusters:
            kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
            clusters = kmeans.fit_predict(embeddings)

        # 5. Run PCA (Reduce to 2D or 3D)
        pca = PCA(n_components=dim)
        reduced_data = pca.fit_transform(embeddings)

        # 6. Format Response
        points = []
        for i, coord in enumerate(reduced_data):
            # Truncate content for display
            content_preview = results[i].get('content', '')[:100] + "..."

            point = {
                "x": float(coord[0]),
                "y": float(coord[1]),
                "filename": results[i].get('filename', 'unknown'),
                "content": content_preview,
                "type": "document"
            }

            # Add cluster ID if clustering is enabled
            if clusters is not None:
                point["cluster"] = int(clusters[i])

            # Add Z coordinate if 3D
            if dim == 3:
                point["z"] = float(coord[2])

            points.append(point)

        return {
            "bucket": bucket_name,
            "dimensions": dim,
            "total_points": len(points),
            "points": points,
            "clustering_enabled": use_clustering,
            "n_clusters": n_clusters if use_clustering else None
        }

    except Exception as e:
        print(f"Visualization error: {e}")
        return {"points": [], "error": str(e)}


@router.post("/visualization/{bucket_name}/query-projection")
async def project_query(
    bucket_name: str,
    request: QueryProjectionRequest
):
    """
    Project a search query into the same space as documents.
    This helps visualize where a query lands in relation to document clusters.
    """
    if PCA is None:
        raise HTTPException(status_code=500, detail="scikit-learn not installed")

    # 1. Connect to Milvus
    try:
        milvus_host = os.getenv("MILVUS_HOST", "localhost")
        milvus_port = os.getenv("MILVUS_PORT", "19530")
        connections.connect("default", host=milvus_host, port=milvus_port)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database connection failed: {e}")

    collection_name = get_collection_name(bucket_name)

    if not utility.has_collection(collection_name):
        raise HTTPException(status_code=404, detail="Collection does not exist")

    try:
        # 2. Fetch existing document vectors
        collection = Collection(collection_name)
        collection.load()

        results = collection.query(
            expr="",
            output_fields=["embedding", "filename", "content"],
            limit=2000
        )

        if not results:
            raise HTTPException(status_code=404, detail="No documents indexed")

        # 3. Get embedding model from bucket config
        from services.minio_service import MinioService
        minio_service = MinioService()
        config = minio_service.get_json(bucket_name, "config.json")
        embedding_model = config.get("embedding_model", "nomic-embed-text")

        # 4. Generate query embedding using Ollama
        embedding_response = ollama.embeddings(model=embedding_model, prompt=request.query)
        query_embedding = np.array([embedding_response['embedding']])

        # 5. Combine query with document embeddings
        doc_embeddings = np.array([r['embedding'] for r in results])
        all_embeddings = np.vstack([doc_embeddings, query_embedding])

        # 6. Run PCA on combined set
        pca = PCA(n_components=request.dim)
        reduced_data = pca.fit_transform(all_embeddings)

        # 7. Format document points
        points = []
        for i in range(len(results)):
            coord = reduced_data[i]
            point = {
                "x": float(coord[0]),
                "y": float(coord[1]),
                "filename": results[i].get('filename', 'unknown'),
                "content": results[i].get('content', '')[:100] + "...",
                "type": "document"
            }
            if request.dim == 3:
                point["z"] = float(coord[2])
            points.append(point)

        # 8. Add query point (last element)
        query_coord = reduced_data[-1]
        query_point = {
            "x": float(query_coord[0]),
            "y": float(query_coord[1]),
            "filename": "🔍 Query",
            "content": request.query,
            "type": "query"
        }
        if request.dim == 3:
            query_point["z"] = float(query_coord[2])
        points.append(query_point)

        return {
            "bucket": bucket_name,
            "dimensions": request.dim,
            "total_points": len(points),
            "points": points,
            "query": request.query
        }

    except Exception as e:
        print(f"Query projection error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/visualization/{bucket_name}/similarity-graph")
async def get_similarity_graph(
    bucket_name: str,
    threshold: float = Query(0.8, ge=0.0, le=1.0, description="Similarity threshold for edges")
):
    """
    Generate a similarity graph showing relationships between documents.
    Returns nodes and edges for force-directed graph visualization.
    """
    if cosine_similarity is None:
        raise HTTPException(status_code=500, detail="scikit-learn not installed")

    # 1. Connect to Milvus
    try:
        milvus_host = os.getenv("MILVUS_HOST", "localhost")
        milvus_port = os.getenv("MILVUS_PORT", "19530")
        connections.connect("default", host=milvus_host, port=milvus_port)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database connection failed: {e}")

    collection_name = get_collection_name(bucket_name)

    if not utility.has_collection(collection_name):
        return {"nodes": [], "edges": [], "message": "Collection does not exist"}

    try:
        # 2. Fetch Vectors
        collection = Collection(collection_name)
        collection.load()

        results = collection.query(
            expr="",
            output_fields=["embedding", "filename", "content"],
            limit=500  # Limit for performance (similarity matrix is O(n²))
        )

        if not results or len(results) < 2:
            return {"nodes": [], "edges": [], "message": "Not enough documents"}

        # 3. Calculate cosine similarity matrix
        embeddings = np.array([r['embedding'] for r in results])
        similarity_matrix = cosine_similarity(embeddings)

        # 4. Create nodes
        nodes = []
        for i, doc in enumerate(results):
            # Get file extension for grouping
            filename = doc.get('filename', 'unknown')
            ext = filename.split('.')[-1] if '.' in filename else 'other'

            nodes.append({
                "id": i,
                "filename": filename,
                "content": doc.get('content', '')[:100] + "...",
                "extension": ext
            })

        # 5. Create edges (only for pairs above threshold)
        edges = []
        for i in range(len(results)):
            for j in range(i + 1, len(results)):
                similarity = similarity_matrix[i][j]
                if similarity >= threshold:
                    edges.append({
                        "source": i,
                        "target": j,
                        "similarity": float(similarity)
                    })

        return {
            "bucket": bucket_name,
            "nodes": nodes,
            "edges": edges,
            "threshold": threshold,
            "total_nodes": len(nodes),
            "total_edges": len(edges)
        }

    except Exception as e:
        print(f"Similarity graph error: {e}")
        return {"nodes": [], "edges": [], "error": str(e)}