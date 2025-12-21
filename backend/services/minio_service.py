import os
import io
import json
from minio import Minio
from minio.error import S3Error

class MinioService:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return
            
        self.minio_client = None
        self._connect()
        self._initialized = True

    def _connect(self):
        try:
            # Connect to MinIO container
            # Using defaults from docker-compose if env vars not set
            endpoint = os.getenv("MINIO_ENDPOINT", "minio:9000")
            access_key = os.getenv("MINIO_ACCESS_KEY", "minioadmin")
            secret_key = os.getenv("MINIO_SECRET_KEY", "minioadmin")
            
            self.minio_client = Minio(
                endpoint,
                access_key=access_key,
                secret_key=secret_key,
                secure=False
            )
            print(f"Connected to MinIO at {endpoint}")
        except Exception as e:
            print(f"Failed to connect to MinIO: {e}")

    def _sanitize_bucket_name(self, name: str) -> str:
        """Sanitize name to be a valid MinIO bucket name."""
        # Lowercase, replace non-alnum with hyphens, strip hyphens
        safe_name = "".join(c if c.isalnum() else "-" for c in name).lower()
        return safe_name.strip("-")

    def list_buckets(self) -> list[str]:
        """List all bucket names."""
        if not self.minio_client:
            return []
        try:
            return [b.name for b in self.minio_client.list_buckets()]
        except Exception as e:
            print(f"Failed to list buckets: {e}")
            return []

    def ensure_bucket(self, bucket_name: str):
        """Create bucket if it doesn't exist."""
        if not self.minio_client:
            return False
        
        safe_name = self._sanitize_bucket_name(bucket_name)    
        try:
            if not self.minio_client.bucket_exists(safe_name):
                self.minio_client.make_bucket(safe_name)
                print(f"Created bucket: {safe_name} (from '{bucket_name}')")
            return True
        except S3Error as e:
            print(f"MinIO bucket error: {e}")
            return False

    def upload_file(self, bucket_name: str, object_name: str, file_path: str):
        """Upload a local file to MinIO."""
        if not self.minio_client:
            return
            
        try:
            safe_name = self._sanitize_bucket_name(bucket_name)
            self.ensure_bucket(bucket_name) # This will use safe_name internally
            self.minio_client.fput_object(
                safe_name,
                object_name,
                file_path
            )
            print(f"Uploaded {object_name} to {safe_name}")
        except S3Error as e:
            print(f"Upload error: {e}")
            raise

    def upload_stream(self, bucket_name: str, object_name: str, data: bytes, length: int):
        """Upload bytes/stream to MinIO."""
        if not self.minio_client:
            return

        try:
            safe_name = self._sanitize_bucket_name(bucket_name)
            self.ensure_bucket(bucket_name)
            self.minio_client.put_object(
                safe_name, 
                object_name, 
                io.BytesIO(data), 
                length
            )
            print(f"Uploaded {object_name} to {safe_name}")
        except S3Error as e:
            print(f"Stream upload error: {e}")
            raise

    def list_objects(self, bucket_name: str, prefix: str = "") -> list[str]:
        """List all object names in a bucket recursively, optionally filtering by prefix."""
        if not self.minio_client:
            return []
        try:
            safe_name = self._sanitize_bucket_name(bucket_name)
            objects = self.minio_client.list_objects(safe_name, prefix=prefix, recursive=True)
            return [obj.object_name for obj in objects]
        except Exception as e:
            print(f"Failed to list objects in {bucket_name}: {e}")
            return []

    def download_bucket(self, bucket_name: str, local_dir: str, prefix: str = ""):
        """Download files from bucket (matching prefix) to local directory."""
        if not self.minio_client:
            return
            
        safe_name = self._sanitize_bucket_name(bucket_name)
        try:
            objects = self.minio_client.list_objects(safe_name, prefix=prefix, recursive=True)
            for obj in objects:
                # Construct local path
                # object_name might contain slashes
                file_path = os.path.join(local_dir, obj.object_name)
                os.makedirs(os.path.dirname(file_path), exist_ok=True)
                
                self.minio_client.fget_object(safe_name, obj.object_name, file_path)
            print(f"Downloaded {safe_name}/{prefix} to {local_dir}")
        except Exception as e:
            print(f"Failed to download bucket {bucket_name}: {e}")
            raise

    def get_json(self, bucket_name: str, object_name: str) -> dict:
        """Read a JSON file from MinIO."""
        if not self.minio_client:
            return {}
        
        safe_name = self._sanitize_bucket_name(bucket_name)
        try:
            response = self.minio_client.get_object(safe_name, object_name)
            data = json.loads(response.read())
            response.close()
            return data
        except Exception as e:
            # print(f"Failed to read JSON {object_name} from {bucket_name}: {e}")
            return {}

    def put_json(self, bucket_name: str, object_name: str, data: dict):
        """Write a JSON file to MinIO."""
        if not self.minio_client:
            return
            
        safe_name = self._sanitize_bucket_name(bucket_name)
        try:
            json_bytes = json.dumps(data, indent=2).encode('utf-8')
            self.minio_client.put_object(
                safe_name,
                object_name,
                io.BytesIO(json_bytes),
                len(json_bytes),
                content_type='application/json'
            )
            print(f"Saved {object_name} to {bucket_name}")
        except Exception as e:
            print(f"Failed to save JSON {object_name} to {bucket_name}: {e}")
            raise

    def remove_object(self, bucket_name: str, object_name: str):
        """Remove an object from MinIO."""
        if not self.minio_client:
            return
        
        safe_name = self._sanitize_bucket_name(bucket_name)
        try:
            self.minio_client.remove_object(safe_name, object_name)
            print(f"Removed {object_name} from {safe_name}")
        except Exception as e:
            print(f"Failed to remove object: {e}")

    def delete_bucket(self, bucket_name: str):
        """Recursively delete a bucket and all its contents."""
        if not self.minio_client:
            return
            
        safe_name = self._sanitize_bucket_name(bucket_name)
        try:
            # 1. List all objects
            objects = self.minio_client.list_objects(safe_name, recursive=True)
            # 2. Remove all objects
            for obj in objects:
                self.minio_client.remove_object(safe_name, obj.object_name)
            
            # 3. Remove the bucket itself
            self.minio_client.remove_bucket(safe_name)
            print(f"Deleted bucket {safe_name}")
        except Exception as e:
            print(f"Failed to delete bucket {safe_name}: {e}")
            raise

minio_service = MinioService()
