import pickle
import re
import io
import numpy as np
from rank_bm25 import BM25Okapi
from services.minio_service import minio_service

class BM25Service:
    def __init__(self):
        self.bm25 = None
        self.filenames = []
        self.contents = []
        
    def tokenize(self, text):
        # Simple whitespace/punctuation tokenizer
        return re.findall(r'\w+', text.lower())

    def build_index(self, contents: list, filenames: list):
        """Build the BM25 index from text chunks."""
        if not contents:
            print("Warning: No content to index for BM25")
            return

        print(f"BM25: Tokenizing {len(contents)} chunks...")
        tokenized_corpus = [self.tokenize(doc) for doc in contents]
        
        print("BM25: Creating index object...")
        self.bm25 = BM25Okapi(tokenized_corpus)
        self.contents = contents
        self.filenames = filenames

    def save_to_minio(self, bucket_name: str):
        """Serialize and save the index to MinIO."""
        if not self.bm25:
            raise ValueError("No index to save")
            
        data = {
            "bm25": self.bm25,
            "contents": self.contents,
            "filenames": self.filenames
        }
        
        # Serialize
        bytes_data = pickle.dumps(data)
        
        # Upload using the service's stream method
        # path: index/bm25.pkl
        try:
            minio_service.upload_stream(
                bucket_name,
                "index/bm25.pkl",
                bytes_data,
                len(bytes_data)
            )
            print(f"BM25 index saved to {bucket_name}/index/bm25.pkl")
        except Exception as e:
            print(f"Failed to save BM25 index: {e}")

    def load_from_minio(self, bucket_name: str):
        """Load the index from MinIO."""
        object_name = "index/bm25.pkl"
        
        # We need direct access to the client to read bytes, 
        # as minio_service.get_json() expects text/json
        if not minio_service.minio_client:
            return False

        try:
            # Check if bucket/object exists first to avoid crash
            # sanitize is internal to minio_service, so we rely on try/catch logic mostly
            # or we can use the client directly if we know the sanitized name.
            # Ideally, we add a get_bytes method to MinioService, but here we access private client.
            safe_bucket = minio_service._sanitize_bucket_name(bucket_name)
            
            response = minio_service.minio_client.get_object(safe_bucket, object_name)
            bytes_data = response.read()
            response.close()
            response.release_conn()
            
            data = pickle.loads(bytes_data)
            
            self.bm25 = data["bm25"]
            self.contents = data["contents"]
            self.filenames = data["filenames"]
            return True
        except Exception as e:
            # It's normal to fail if index doesn't exist yet
            # print(f"Could not load BM25 index for {bucket_name}: {e}")
            return False

    def search(self, query: str, top_k: int = 10):
        """Return top_k results using keyword search."""
        if not self.bm25:
            return []
            
        tokenized_query = self.tokenize(query)
        # Check if query has tokens
        if not tokenized_query:
            return []

        scores = self.bm25.get_scores(tokenized_query)
        
        # Get indices of top_k scores
        # We use argpartition for efficiency if array is large, 
        # but argsort is fine for <100k chunks
        top_n = np.argsort(scores)[::-1][:top_k]
        
        results = []
        for i in top_n:
            # Filter out zero scores (no keyword match)
            if scores[i] > 0:
                results.append({
                    "content": self.contents[i],
                    "filename": self.filenames[i],
                    "score": float(scores[i]),
                    "type": "bm25"
                })
                
        return results