from fastapi import APIRouter, HTTPException
from pymilvus import connections, utility, Collection
from services.bucket_manager import bucket_manager
import os

router = APIRouter()

@router.get("/collections")
async def get_all_collections():
    """Get list of all Milvus collections with metadata."""
    try:
        milvus_host = os.getenv("MILVUS_HOST", "localhost")
        milvus_port = os.getenv("MILVUS_PORT", "19530")

        connections.connect("metadata", host=milvus_host, port=milvus_port)

        collection_names = utility.list_collections(using="metadata")
        collections_data = []

        for name in collection_names:
            try:
                collection = Collection(name, using="metadata")
                collection.load()

                # Get collection stats
                num_entities = collection.num_entities

                # Get schema information
                schema = collection.schema
                fields_info = []
                for field in schema.fields:
                    field_data = {
                        "name": field.name,
                        "type": str(field.dtype),
                        "is_primary": field.is_primary,
                    }
                    if hasattr(field, 'dim'):
                        field_data["dimension"] = field.dim
                    if hasattr(field, 'max_length'):
                        field_data["max_length"] = field.max_length
                    fields_info.append(field_data)

                # Get index information
                indexes = []
                try:
                    for field in schema.fields:
                        if field.dtype in [6]:  # FLOAT_VECTOR type
                            index_info = collection.index(field_name=field.name)
                            if index_info:
                                indexes.append({
                                    "field": field.name,
                                    "type": index_info.params.get("index_type", "Unknown"),
                                    "metric": index_info.params.get("metric_type", "Unknown"),
                                })
                except:
                    pass

                collections_data.append({
                    "name": name,
                    "num_entities": num_entities,
                    "description": schema.description,
                    "fields": fields_info,
                    "indexes": indexes,
                })
            except Exception as e:
                print(f"Error loading collection {name}: {e}")
                collections_data.append({
                    "name": name,
                    "error": str(e)
                })

        connections.disconnect("metadata")

        return {
            "total_collections": len(collection_names),
            "collections": collections_data
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching metadata: {str(e)}")

@router.get("/collection/{collection_name}")
async def get_collection_metadata(collection_name: str):
    """Get detailed metadata for a specific collection."""
    try:
        milvus_host = os.getenv("MILVUS_HOST", "localhost")
        milvus_port = os.getenv("MILVUS_PORT", "19530")

        connections.connect("metadata", host=milvus_host, port=milvus_port)

        if not utility.has_collection(collection_name, using="metadata"):
            connections.disconnect("metadata")
            raise HTTPException(status_code=404, detail=f"Collection '{collection_name}' not found")

        collection = Collection(collection_name, using="metadata")
        collection.load()

        # Get collection stats
        num_entities = collection.num_entities

        # Get schema information
        schema = collection.schema
        fields_info = []
        for field in schema.fields:
            field_data = {
                "name": field.name,
                "type": str(field.dtype),
                "is_primary": field.is_primary,
                "auto_id": getattr(field, 'auto_id', False),
            }
            if hasattr(field, 'dim'):
                field_data["dimension"] = field.dim
            if hasattr(field, 'max_length'):
                field_data["max_length"] = field.max_length
            fields_info.append(field_data)

        # Get index information
        indexes = []
        for field in schema.fields:
            try:
                if field.dtype in [6]:  # FLOAT_VECTOR type
                    index_info = collection.index(field_name=field.name)
                    if index_info:
                        indexes.append({
                            "field": field.name,
                            "type": index_info.params.get("index_type", "Unknown"),
                            "metric": index_info.params.get("metric_type", "Unknown"),
                            "params": index_info.params
                        })
            except Exception as e:
                print(f"Error getting index for field {field.name}: {e}")

        # Sample some data (first 10 records)
        try:
            query_result = collection.query(
                expr="",
                limit=10,
                output_fields=["id", "filename", "content"]
            )
            sample_data = query_result
        except Exception as e:
            print(f"Error querying sample data: {e}")
            sample_data = []

        connections.disconnect("metadata")

        return {
            "name": collection_name,
            "num_entities": num_entities,
            "description": schema.description,
            "fields": fields_info,
            "indexes": indexes,
            "sample_data": sample_data[:10]  # Limit to 10 samples
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching collection metadata: {str(e)}")
