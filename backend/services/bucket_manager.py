"""
Service for managing Buckets (Spaces) and their directories.
"""
import json
import os
from typing import List, Optional, Dict, Any
from datetime import datetime
from models.schemas import Bucket, BucketConfig

class BucketManager:
    def __init__(self):
        self.buckets: List[Bucket] = []
        self.current_bucket_name: Optional[str] = None
        self._load_buckets()

    def _load_buckets(self):
        """Load buckets from MinIO."""
        self.buckets = []
        try:
            from services.minio_service import minio_service
            if not minio_service.minio_client:
                print("MinIO not available, cannot load buckets.")
                return

            bucket_names = minio_service.list_buckets()
            
            for name in bucket_names:
                # Try to read config.json
                # Note: 'name' from list_buckets is the internal safe name (e.g. 'my-space')
                # But we want to display the user-friendly name if possible.
                # If we stored the user-friendly name in config.json, we can retrieve it.
                # If config.json doesn't exist, we assume it's a legacy bucket or bare bucket.
                
                config_data = minio_service.get_json(name, "config.json")
                
                # If config exists, use it to populate Bucket object
                # If user_friendly_name is in config, use that for display?
                # For now, let's assume the MinIO bucket name is the name we use, 
                # unless we want to solve the "Original Name" issue fully. 
                # The prompt said "create a bucket on MinIO (as you are doing it now)".
                # Previously we stored "My Space" -> "my-space".
                # If we rely ONLY on MinIO, we lose "My Space" formatting unless we save it in config.json.
                
                display_name = config_data.get("name", name) # Fallback to bucket name
                
                # Reconstruct Bucket object
                bucket = Bucket(name=display_name)
                
                # Load config
                if "config" in config_data:
                    bucket.config = BucketConfig(**config_data["config"])
                
                # Load stats
                if "last_indexed" in config_data:
                    try:
                        bucket.last_indexed = datetime.fromisoformat(config_data["last_indexed"])
                    except: pass
                if "file_count" in config_data:
                    bucket.file_count = config_data["file_count"]
                
                # Sync uploads
                # List objects in uploads/
                uploads = minio_service.list_objects(name, prefix="uploads/")
                bucket.directories = uploads
                
                self.buckets.append(bucket)

            # Set current bucket (default to first if available)
            if self.buckets and not self.current_bucket_name:
                self.current_bucket_name = self.buckets[0].name

        except Exception as e:
            print(f"Error loading buckets from MinIO: {e}")

    def _save_bucket_config(self, bucket: Bucket):
        """Save bucket metadata to config.json in MinIO."""
        try:
            from services.minio_service import minio_service
            data = {
                "name": bucket.name,
                "config": bucket.config.dict() if bucket.config else {},
                "last_indexed": bucket.last_indexed.isoformat() if bucket.last_indexed else None,
                "file_count": bucket.file_count
            }
            minio_service.put_json(bucket.name, "config.json", data)
        except Exception as e:
            print(f"Failed to save config for {bucket.name}: {e}")

    def get_buckets(self) -> List[Bucket]:
        # Refresh? Or just return cached?
        # For performance, return cached. Refresh should be triggered explicitly or on init.
        # But if we want real-time, we might check. For now, cached is fine.
        return self.buckets

    def get_current_bucket(self) -> Optional[Bucket]:
        if not self.current_bucket_name:
            return None
        return next((b for b in self.buckets if b.name == self.current_bucket_name), None)

    def create_bucket(self, name: str, config: Optional[BucketConfig] = None) -> Bucket:
        # Check if already exists in our list (which reflects MinIO)
        if any(b.name == name for b in self.buckets):
            raise ValueError(f"Space '{name}' already exists")
        
        from services.minio_service import minio_service
        
        # 1. Create MinIO Bucket (ensure_bucket handles sanitization)
        if not minio_service.ensure_bucket(name):
             raise ValueError(f"Failed to create storage for '{name}'")
        
        # 2. Create Bucket Object
        new_config = config if config else BucketConfig()
        new_bucket = Bucket(name=name, config=new_config)
        
        # 3. Save initial config.json
        self._save_bucket_config(new_bucket)

        # 4. Update local state
        self.buckets.append(new_bucket)
        self.current_bucket_name = name
        
        return new_bucket
    
    def update_bucket_config(self, name: str, config: BucketConfig) -> Bucket:
        bucket = next((b for b in self.buckets if b.name == name), None)
        if not bucket:
            raise ValueError(f"Space '{name}' not found")
        
        bucket.config = config
        self._save_bucket_config(bucket)
        return bucket

    def sync_bucket_files(self, bucket_name: str) -> Bucket:
        """Sync bucket.directories with actual MinIO objects in uploads/."""
        bucket = next((b for b in self.buckets if b.name == bucket_name), None)
        if not bucket:
            return None
        
        try:
            from services.minio_service import minio_service
            # List only objects in uploads/
            objects = minio_service.list_objects(bucket_name, prefix="uploads/")
            bucket.directories = objects
            # We don't need to save this list to config.json as it's dynamic
        except Exception as e:
            print(f"Failed to sync bucket files: {e}")
        
        return bucket

    def select_bucket(self, name: str) -> Bucket:
        bucket = next((b for b in self.buckets if b.name == name), None)
        if not bucket:
            # Try reloading in case it was created externally
            self._load_buckets()
            bucket = next((b for b in self.buckets if b.name == name), None)
            if not bucket:
                raise ValueError(f"Space '{name}' not found")
        
        self.current_bucket_name = name
        # Sync files logic is now implicitly part of load or explicit sync
        self.sync_bucket_files(name)
        return bucket

    def add_directory(self, bucket_name: str, path: str) -> Bucket:
        return self.sync_bucket_files(bucket_name)

    def add_directories(self, bucket_name: str, paths: List[str]) -> Bucket:
        return self.sync_bucket_files(bucket_name)

    def remove_directories(self, bucket_name: str, paths: List[str]) -> Bucket:
        bucket = next((b for b in self.buckets if b.name == bucket_name), None)
        if bucket:
            from services.minio_service import minio_service
            for path in paths:
                # Path should already include 'uploads/' if it came from the UI/list
                minio_service.remove_object(bucket_name, path)
            
            self.sync_bucket_files(bucket_name)
        return bucket

    def update_stats(self, bucket_name: str, file_count: int):
        """Update indexing statistics."""
        bucket = next((b for b in self.buckets if b.name == bucket_name), None)
        if bucket:
            bucket.last_indexed = datetime.utcnow()
            bucket.file_count = file_count
            self._save_bucket_config(bucket)

    def delete_bucket(self, name: str):
        """Delete a bucket (Space) and all its data."""
        bucket = next((b for b in self.buckets if b.name == name), None)
        if not bucket:
            raise ValueError(f"Space '{name}' not found")
        
        try:
            from services.minio_service import minio_service
            # Delete from MinIO
            minio_service.delete_bucket(name)
        except Exception as e:
            print(f"Error deleting bucket {name}: {e}") # Changed from MinIO bucket to bucket {name}
            raise

        # Update local list
        self.buckets = [b for b in self.buckets if b.name != name]
        
        # Reset current bucket if it was the one deleted
        if self.current_bucket_name == name:
            self.current_bucket_name = self.buckets[0].name if self.buckets else None
            
        return {"message": f"Space '{name}' deleted successfully"}
    
    def get_space_stats(self, bucket_name: str) -> Dict[str, Any]:
        """Get comprehensive statistics for a space."""
        from services.minio_service import minio_service
        from services.chat_manager import chat_manager
        from collections import Counter
        
        bucket = next((b for b in self.buckets if b.name == bucket_name), None)
        if not bucket:
            raise ValueError(f"Space '{bucket_name}' not found")
        
        # Get file stats from MinIO
        try:
            files = minio_service.list_objects(bucket_name, prefix="uploads/")
            total_files = len(files)
            
            # Count file types
            file_types = Counter()
            for file_path in files:
                ext = file_path.split('.')[-1] if '.' in file_path else 'no_ext'
                file_types[ext] += 1
            
            # Convert to list for frontend
            file_type_distribution = [
                {"type": ext, "count": count}
                for ext, count in file_types.most_common()
            ]
        except Exception as e:
            print(f"Error getting file stats: {e}")
            total_files = 0
            file_type_distribution = []
        
        # Get chat stats
        chat_stats = chat_manager.get_chat_stats(bucket_name)
        
        # Get indexing status
        indexed_files = bucket.file_count
        indexing_status = "Not Indexed" if indexed_files == 0 else "Indexed"
        
        return {
            "space_name": bucket_name,
            "total_files": total_files,
            "indexed_files": indexed_files,
            "indexing_status": indexing_status,
            "last_indexed": bucket.last_indexed,
            "total_sessions": chat_stats["total_sessions"],
            "total_messages": chat_stats["total_messages"],
            "last_chat_activity": chat_stats["last_activity"],
            "file_type_distribution": file_type_distribution,
            "directories_count": len(bucket.directories)
        }

bucket_manager = BucketManager()