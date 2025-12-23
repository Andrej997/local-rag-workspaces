"""
Milvus connection management service.
Provides connection pooling and proper resource cleanup.
"""
import os
from typing import Optional
from contextlib import contextmanager
from pymilvus import connections, Collection, utility
from utils.logger import get_logger
from utils.sanitizers import sanitize_collection_name

logger = get_logger(__name__)


class MilvusService:
    """
    Singleton service for managing Milvus connections.
    Prevents connection leaks by reusing connections and providing proper cleanup.
    """

    _instance = None
    _connection_alias = "default"
    _is_connected = False

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(MilvusService, cls).__new__(cls)
        return cls._instance

    def __init__(self):
        if not hasattr(self, '_initialized'):
            self.host = os.getenv("MILVUS_HOST", "localhost")
            self.port = int(os.getenv("MILVUS_PORT", "19530"))
            self._initialized = True
            logger.info(f"MilvusService initialized with host={self.host}, port={self.port}")

    def connect(self, alias: str = None) -> None:
        """
        Establish connection to Milvus.

        Args:
            alias: Connection alias (default: "default")

        Raises:
            Exception: If connection fails
        """
        alias = alias or self._connection_alias

        try:
            # Check if already connected
            if connections.has_connection(alias):
                logger.debug(f"Milvus connection '{alias}' already exists")
                return

            # Connect
            connections.connect(
                alias=alias,
                host=self.host,
                port=self.port
            )
            self._is_connected = True
            logger.info(f"Connected to Milvus at {self.host}:{self.port}")

        except Exception as e:
            logger.error(f"Failed to connect to Milvus: {str(e)}")
            self._is_connected = False
            raise Exception(f"Could not connect to vector database: {str(e)}")

    def disconnect(self, alias: str = None) -> None:
        """
        Disconnect from Milvus.

        Args:
            alias: Connection alias (default: "default")
        """
        alias = alias or self._connection_alias

        try:
            if connections.has_connection(alias):
                connections.disconnect(alias)
                self._is_connected = False
                logger.info(f"Disconnected from Milvus (alias: {alias})")
        except Exception as e:
            logger.error(f"Error disconnecting from Milvus: {str(e)}")

    @contextmanager
    def get_connection(self, alias: str = None):
        """
        Context manager for Milvus connections.
        Ensures connection is established and properly maintained.

        Usage:
            with milvus_service.get_connection() as conn_alias:
                collection = Collection("my_collection", using=conn_alias)
                # ... use collection ...

        Args:
            alias: Connection alias

        Yields:
            Connection alias string
        """
        alias = alias or self._connection_alias

        try:
            # Ensure connected
            self.connect(alias)
            yield alias
        except Exception as e:
            logger.error(f"Error in Milvus connection context: {str(e)}")
            raise
        # Note: We don't disconnect here to reuse the connection

    def get_collection(self, collection_name: str, sanitize: bool = True, alias: str = None) -> Collection:
        """
        Get a Milvus collection with automatic connection management.

        Args:
            collection_name: Name of the collection
            sanitize: Whether to sanitize the collection name
            alias: Connection alias

        Returns:
            Collection instance

        Raises:
            Exception: If collection doesn't exist or connection fails
        """
        alias = alias or self._connection_alias

        if sanitize:
            collection_name = sanitize_collection_name(collection_name)

        # Ensure connected
        self.connect(alias)

        # Check if collection exists
        if not utility.has_collection(collection_name, using=alias):
            raise ValueError(f"Collection '{collection_name}' does not exist")

        # Return collection
        collection = Collection(collection_name, using=alias)
        return collection

    def collection_exists(self, collection_name: str, sanitize: bool = True, alias: str = None) -> bool:
        """
        Check if a collection exists.

        Args:
            collection_name: Name of the collection
            sanitize: Whether to sanitize the collection name
            alias: Connection alias

        Returns:
            True if collection exists, False otherwise
        """
        alias = alias or self._connection_alias

        if sanitize:
            collection_name = sanitize_collection_name(collection_name)

        try:
            self.connect(alias)
            return utility.has_collection(collection_name, using=alias)
        except Exception as e:
            logger.error(f"Error checking collection existence: {str(e)}")
            return False

    def list_collections(self, alias: str = None) -> list:
        """
        List all collections in Milvus.

        Args:
            alias: Connection alias

        Returns:
            List of collection names
        """
        alias = alias or self._connection_alias

        try:
            self.connect(alias)
            return utility.list_collections(using=alias)
        except Exception as e:
            logger.error(f"Error listing collections: {str(e)}")
            return []

    def drop_collection(self, collection_name: str, sanitize: bool = True, alias: str = None) -> bool:
        """
        Drop a collection from Milvus.

        Args:
            collection_name: Name of the collection to drop
            sanitize: Whether to sanitize the collection name
            alias: Connection alias

        Returns:
            True if successful, False otherwise
        """
        alias = alias or self._connection_alias

        if sanitize:
            collection_name = sanitize_collection_name(collection_name)

        try:
            self.connect(alias)
            if utility.has_collection(collection_name, using=alias):
                utility.drop_collection(collection_name, using=alias)
                logger.info(f"Dropped collection '{collection_name}'")
                return True
            else:
                logger.warning(f"Collection '{collection_name}' does not exist")
                return False
        except Exception as e:
            logger.error(f"Error dropping collection '{collection_name}': {str(e)}")
            return False

    def get_connection_info(self) -> dict:
        """
        Get current connection information.

        Returns:
            Dictionary with connection details
        """
        return {
            "host": self.host,
            "port": self.port,
            "is_connected": self._is_connected,
            "connection_alias": self._connection_alias
        }


# Singleton instance
_milvus_service = MilvusService()


def get_milvus_service() -> MilvusService:
    """
    Get the singleton MilvusService instance.

    Returns:
        MilvusService instance
    """
    return _milvus_service
