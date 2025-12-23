"""
Advanced RAG (Retrieval-Augmented Generation) Service
Implements: Hybrid Search (Vector + BM25) + Reciprocal Rank Fusion + Reranking
"""
from typing import List, Tuple
import ollama
from services.milvus_service import get_milvus_service
from services.bm25_service import BM25Service
from services.reranker_service import rerank_documents
from utils.logger import get_logger

logger = get_logger(__name__)


class RAGService:
    """Service for advanced RAG operations"""

    def __init__(self):
        self.milvus_service = get_milvus_service()

    @staticmethod
    def expand_query(original_query: str, model_name: str) -> List[str]:
        """
        Use LLM to generate variations of the user query for better retrieval.

        Args:
            original_query: The user's original question
            model_name: The LLM model to use for expansion

        Returns:
            List of query variations including the original
        """
        try:
            prompt = (
                f"Generate 3 different search queries to answer this user question. "
                f"Focus on technical terms and synonyms. "
                f"Output only the queries, one per line. Do not number them.\n\n"
                f"User Question: {original_query}"
            )
            response = ollama.chat(model=model_name, messages=[{'role': 'user', 'content': prompt}])
            content = response['message']['content']
            # Parse lines
            queries = [line.strip().lstrip('- ') for line in content.split('\n') if line.strip()]
            return list(set([original_query] + queries))
        except Exception as e:
            logger.warning(f"Query expansion failed: {str(e)}")
            return [original_query]

    @staticmethod
    def reciprocal_rank_fusion(results_list: List[List[dict]], k: int = 60) -> List[dict]:
        """
        Combines results from multiple retrieval sources using Reciprocal Rank Fusion.

        Args:
            results_list: List of result lists from different retrieval methods
            k: RRF parameter (default: 60)

        Returns:
            Fused and ranked list of documents
        """
        fused_scores = {}

        for results in results_list:
            for rank, doc in enumerate(results):
                # Create a unique key (filename + content hash snippet)
                # This handles duplicate chunks found by different methods
                key = f"{doc['filename']}_{hash(doc['content'][:50])}"

                if key not in fused_scores:
                    fused_scores[key] = {'doc': doc, 'score': 0.0}

                # RRF Formula: 1 / (rank + k)
                fused_scores[key]['score'] += 1 / (rank + k)

        # Convert back to list sorted by fused score
        final_results = sorted(fused_scores.values(), key=lambda x: x['score'], reverse=True)
        return [item['doc'] for item in final_results]

    def retrieve_context(
        self,
        query: str,
        collection_name: str,
        bucket_name: str,
        embedding_model: str = 'nomic-embed-text',
        top_k: int = 5,
        enable_reranking: bool = True
    ) -> Tuple[List[dict], str]:
        """
        Perform advanced RAG retrieval combining multiple methods.

        Args:
            query: User's search query
            collection_name: Milvus collection name (sanitized)
            bucket_name: Bucket/space name for BM25 lookup
            embedding_model: Model to use for vector embeddings
            top_k: Number of final results to return
            enable_reranking: Whether to apply cross-encoder reranking

        Returns:
            Tuple of (retrieved_chunks, context_string)
        """
        all_results = []

        # A. Vector Search
        try:
            embedding_response = ollama.embeddings(model=embedding_model, prompt=query)
            query_vector = embedding_response['embedding']

            # Use MilvusService to get collection
            collection = self.milvus_service.get_collection(collection_name, sanitize=False)
            collection.load()

            results = collection.search(
                data=[query_vector],
                anns_field="embedding",
                param={"metric_type": "L2", "params": {"nprobe": 10}},
                limit=20,  # Fetch more for reranking
                output_fields=["content", "filename"]
            )

            vector_chunks = []
            for hits in results:
                for hit in hits:
                    vector_chunks.append({
                        "filename": hit.entity.get("filename"),
                        "content": hit.entity.get("content"),
                        "score": hit.score,
                        "type": "vector"
                    })
            all_results.append(vector_chunks)
            logger.info(f"Vector search returned {len(vector_chunks)} results")
        except Exception as e:
            logger.error(f"Vector search failed: {str(e)}")

        # B. BM25 Keyword Search
        try:
            bm25 = BM25Service()
            if bm25.load_from_minio(bucket_name):
                keyword_results = bm25.search(query, top_k=20)
                all_results.append(keyword_results)
                logger.info(f"BM25 search returned {len(keyword_results)} results")
        except Exception as e:
            logger.warning(f"BM25 search failed: {str(e)}")

        # C. Fusion (RRF)
        candidates = self.reciprocal_rank_fusion(all_results)
        logger.info(f"RRF fusion produced {len(candidates)} candidates")

        # D. Reranking (Cross-Encoder)
        if enable_reranking:
            try:
                final_chunks = rerank_documents(query, candidates[:50], top_k=top_k)
                logger.info(f"Reranking selected top {len(final_chunks)} results")
            except Exception as e:
                logger.warning(f"Reranking failed, falling back to raw results: {str(e)}")
                final_chunks = candidates[:top_k]
        else:
            final_chunks = candidates[:top_k]

        # E. Format Context String
        context_str = ""
        for chunk in final_chunks:
            context_str += f"\n--- File: {chunk['filename']} ---\n{chunk['content']}\n"

        return final_chunks, context_str


# Singleton instance
_rag_service = None

def get_rag_service() -> RAGService:
    """Get or create the RAG service singleton"""
    global _rag_service
    if _rag_service is None:
        _rag_service = RAGService()
    return _rag_service
