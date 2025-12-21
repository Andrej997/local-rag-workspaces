"""
Refactored indexer with callback support for progress tracking.
Supports indexing multiple directories OR single files into a specific Milvus collection.
"""
import os
import re
import ollama
from pypdf import PdfReader
from docx import Document
from openpyxl import load_workbook
from pptx import Presentation
from pymilvus import connections, Collection, FieldSchema, CollectionSchema, DataType, utility
from typing import Callable, Optional, List
from services.file_types import is_supported_file


class IndexerWithCallbacks:
    """
    Codebase indexer with callback-based progress reporting.
    """

    def __init__(
        self,
        target_paths: List[str],
        collection_name: str,
        chunk_size: int = 1000,
        embedding_model: str = "nomic-embed-text",
        embedding_dim: Optional[int] = None,
        progress_callback: Optional[Callable] = None,
        error_callback: Optional[Callable] = None
    ):
        self.target_paths = target_paths
        self.collection_name = re.sub(r'[^a-zA-Z0-9_]', '_', collection_name)
        self.chunk_size = chunk_size
        self.embedding_model = embedding_model
        self.embedding_dim = embedding_dim
        self.progress_callback = progress_callback or (lambda **kwargs: None)
        self.error_callback = error_callback or (lambda **kwargs: None)
        self.should_stop = False
        self.collection = None

    def emit_progress(self, **kwargs):
        if self.progress_callback:
            self.progress_callback(**kwargs)

    def emit_error(self, **kwargs):
        if self.error_callback:
            self.error_callback(**kwargs)

    def stop(self):
        self.should_stop = True
        self.emit_progress(type='stopped', message='Indexing stopped by user')

    def validate_paths(self) -> bool:
        if not self.target_paths:
            self.emit_error(type='error', error='No paths', message='No paths specified for indexing')
            return False

        for path in self.target_paths:
            if not os.path.exists(path):
                self.emit_error(type='error', error='Invalid path', message=f'Path does not exist: {path}')
                return False
        return True

    def connect_to_milvus(self) -> bool:
        try:
            milvus_host = os.getenv("MILVUS_HOST", "localhost")
            milvus_port = os.getenv("MILVUS_PORT", "19530")
            connections.connect("default", host=milvus_host, port=milvus_port)
            self.emit_progress(type='milvus_connected', message=f'Connected to Milvus at {milvus_host}:{milvus_port}')
            return True
        except Exception as e:
            self.emit_error(type='error', error='Milvus connection failed', message=f'Error connecting to Milvus: {str(e)}')
            return False

    def setup_collection(self):
        # Auto-detect embedding dimension if not provided
        if not self.embedding_dim:
            try:
                self.emit_progress(type='detecting_dimension', message=f'Detecting embedding dimension for {self.embedding_model}...')
                test_embedding = ollama.embeddings(model=self.embedding_model, prompt="test")
                self.embedding_dim = len(test_embedding['embedding'])
                self.emit_progress(type='dimension_detected', message=f'Detected dimension: {self.embedding_dim}')
            except Exception as e:
                self.emit_error(type='error', error='Dimension detection failed', message=f'Failed to detect embedding dimension: {str(e)}')
                raise

        fields = [
            FieldSchema(name="id", dtype=DataType.INT64, is_primary=True, auto_id=True),
            FieldSchema(name="content", dtype=DataType.VARCHAR, max_length=5000),
            FieldSchema(name="filename", dtype=DataType.VARCHAR, max_length=500),
            FieldSchema(name="embedding", dtype=DataType.FLOAT_VECTOR, dim=self.embedding_dim)
        ]
        schema = CollectionSchema(fields, f"Codebase search collection for {self.collection_name}")

        if utility.has_collection(self.collection_name):
            self.emit_progress(type='collection_reset', message=f'Deleting existing collection {self.collection_name}')
            utility.drop_collection(self.collection_name)

        self.collection = Collection(self.collection_name, schema)
        self.emit_progress(type='collection_created', message=f'Created collection {self.collection_name} (dim={self.embedding_dim})')

    def count_files(self) -> int:
        """Count total indexable files in all target paths (files or directories)."""
        total_files = 0

        for path in self.target_paths:
            if os.path.isfile(path):
                if is_supported_file(path):
                    total_files += 1
            elif os.path.isdir(path):
                for root, dirs, files in os.walk(path):
                    if '.git' in root or 'venv' in root or '__pycache__' in root or 'node_modules' in root:
                        continue
                    for file in files:
                        if is_supported_file(file):
                            total_files += 1
        return total_files

    def _process_single_file(self, path, files_processed, total_files, data_content, data_filename, data_embeddings):
        """Helper to process a single file."""
        try:
            filename = os.path.basename(path)
            self.emit_progress(
                type='file_started',
                current_file=filename,
                files_processed=files_processed,
                files_total=total_files,
                percentage=round((files_processed / total_files) * 100, 2) if total_files > 0 else 0
            )

            # Extract text based on file type
            text = ""
            file_lower = path.lower()

            try:
                if file_lower.endswith('.pdf'):
                    # Handle PDF files
                    reader = PdfReader(path)
                    for page in reader.pages:
                        page_text = page.extract_text()
                        if page_text:
                            text += page_text + "\n"

                elif file_lower.endswith('.docx'):
                    # Handle Word documents
                    doc = Document(path)
                    for paragraph in doc.paragraphs:
                        text += paragraph.text + "\n"
                    # Also extract text from tables
                    for table in doc.tables:
                        for row in table.rows:
                            for cell in row.cells:
                                text += cell.text + " "
                            text += "\n"

                elif file_lower.endswith('.xlsx') or file_lower.endswith('.xls'):
                    # Handle Excel spreadsheets
                    workbook = load_workbook(path, data_only=True)
                    for sheet_name in workbook.sheetnames:
                        sheet = workbook[sheet_name]
                        text += f"\n--- Sheet: {sheet_name} ---\n"
                        for row in sheet.iter_rows(values_only=True):
                            row_text = " | ".join([str(cell) if cell is not None else "" for cell in row])
                            if row_text.strip():
                                text += row_text + "\n"

                elif file_lower.endswith('.pptx'):
                    # Handle PowerPoint presentations
                    prs = Presentation(path)
                    for slide_num, slide in enumerate(prs.slides, 1):
                        text += f"\n--- Slide {slide_num} ---\n"
                        for shape in slide.shapes:
                            if hasattr(shape, "text"):
                                text += shape.text + "\n"

                else:
                    # Handle text files
                    with open(path, "r", encoding="utf-8", errors='ignore') as f:
                        text = f.read()

            except Exception as extract_error:
                self.emit_error(
                    type='file_error',
                    current_file=filename,
                    error=str(extract_error),
                    message=f'Error extracting {filename}: {str(extract_error)}'
                )
                return 0

            if not text.strip():
                return 0

            chunks = [text[i:i+self.chunk_size] for i in range(0, len(text), self.chunk_size)]

            for chunk in chunks:
                if self.should_stop: break

                response = ollama.embeddings(model=self.embedding_model, prompt=chunk)
                embedding = response['embedding']

                data_content.append(chunk)
                data_filename.append(filename)
                data_embeddings.append(embedding)

            return len(chunks)

        except Exception as e:
            self.emit_error(type='file_error', current_file=filename, error=str(e), message=f'Error processing {filename}: {str(e)}')
            return 0

    def process_files(self, total_files: int):
        data_content = []
        data_filename = []
        data_embeddings = []
        files_processed = 0
        total_chunks = 0

        self.emit_progress(
            type='started',
            files_total=total_files,
            files_processed=0,
            chunks_total=0,
            percentage=0.0,
            message=f'Starting indexing (Chunk size: {self.chunk_size})'
        )

        for path in self.target_paths:
            if self.should_stop: break

            # Case 1: Single File
            if os.path.isfile(path):
                # Skip unsupported files
                if not is_supported_file(path):
                    continue

                chunks_added = self._process_single_file(
                    path, files_processed, total_files,
                    data_content, data_filename, data_embeddings
                )
                total_chunks += chunks_added
                files_processed += 1

                self.emit_progress(
                    type='file_completed',
                    current_file=os.path.basename(path),
                    files_processed=files_processed,
                    files_total=total_files,
                    chunks_total=total_chunks,
                    percentage=round((files_processed / total_files) * 100, 2) if total_files > 0 else 0,
                    message=f'Processed {os.path.basename(path)}'
                )

            # Case 2: Directory
            elif os.path.isdir(path):
                for root, dirs, files in os.walk(path):
                    if self.should_stop: break
                    if '.git' in root or 'venv' in root or '__pycache__' in root or 'node_modules' in root:
                        continue

                    for file in files:
                        if self.should_stop: break

                        # Skip unsupported files
                        if not is_supported_file(file):
                            continue

                        full_path = os.path.join(root, file)
                        chunks_added = self._process_single_file(
                            full_path, files_processed, total_files,
                            data_content, data_filename, data_embeddings
                        )
                        total_chunks += chunks_added
                        files_processed += 1

                        self.emit_progress(
                            type='file_completed',
                            current_file=file,
                            files_processed=files_processed,
                            files_total=total_files,
                            chunks_total=total_chunks,
                            percentage=round((files_processed / total_files) * 100, 2) if total_files > 0 else 0,
                            message=f'Processed {file}'
                        )

        return [data_content, data_filename, data_embeddings]

    def run(self):
        try:
            if not self.validate_paths(): return
            if not self.connect_to_milvus(): return

            self.setup_collection()

            self.emit_progress(type='counting_files', message='Counting files...')
            total_files = self.count_files()
            self.emit_progress(type='files_counted', files_total=total_files, message=f'Found {total_files} files')

            if total_files == 0:
                self.emit_progress(type='complete', files_total=0, percentage=100.0, message='No valid files found')
                return

            my_data = self.process_files(total_files)

            if self.should_stop: return

            if my_data[0]:
                self.emit_progress(type='inserting_data', message=f'Inserting {len(my_data[0])} vectors...')
                self.collection.insert(my_data)

                self.emit_progress(type='creating_index', message='Creating vector index...')
                index_params = {"metric_type": "L2", "index_type": "IVF_FLAT", "params": {"nlist": 128}}
                self.collection.create_index("embedding", index_params)
                self.collection.load()

                self.emit_progress(type='complete', files_total=total_files, files_processed=total_files, chunks_total=len(my_data[0]), embedding_dim=self.embedding_dim, percentage=100.0, message='Indexing completed successfully!')
            else:
                self.emit_progress(type='complete', files_total=total_files, embedding_dim=self.embedding_dim, percentage=100.0, message='No content extracted')

        except Exception as e:
            self.emit_error(type='error', error='Indexing failed', message=f'Fatal error: {str(e)}')
            raise