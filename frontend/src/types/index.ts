/**
 * Type definitions for the application
 */

export interface Bucket {
  name: string;
  directories: string[];
  files: FileMetadata[];
  config?: BucketConfig;
}

export interface BucketConfig {
  chunk_size: number;
  llm_model: string;
  embedding_model: string;
  temperature: number;
}

export interface FileMetadata {
  path: string;
  size: number;
  last_modified: string;
}

export interface IndexingStatus {
  is_running: boolean;
  current_file?: string;
  files_processed?: number;
  total_files?: number;
  error?: string;
}

export interface ProgressState {
  percentage: number;
  current_file: string;
  files_processed: number;
  total_files: number;
  error: string | null;
}

export interface IndexingState {
  buckets: Bucket[];
  currentBucket: Bucket | null;
  indexingStatus: IndexingStatus | null;
  progress: ProgressState;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  sources?: DocumentSource[];
  timestamp: string;
}

export interface DocumentSource {
  filename: string;
  content: string;
  score: number;
  type: 'vector' | 'bm25' | 'context';
  rerank_score?: number;
}

export interface ChatSession {
  id: number;
  created_at?: string;
  last_message_at?: string;
}

export interface ServiceHealth {
  name: string;
  status: 'healthy' | 'unhealthy' | 'unknown';
  message: string;
}

export interface SystemStats {
  total_spaces: number;
  total_files_indexed: number;
  total_directories: number;
  space_stats: SpaceStats[];
}

export interface SpaceStats {
  name: string;
  files: number;
  directories: number;
}

export interface DetailedSpaceStats {
  total_files: number;
  indexed_files: number;
  total_sessions: number;
  total_messages: number;
  indexing_status: string;
  last_indexed?: string;
  last_chat_activity?: string;
  file_type_distribution: FileTypeDistribution[];
}

export interface FileTypeDistribution {
  type: string;
  count: number;
}

export interface OllamaModel {
  name: string;
  modified_at?: string;
  size?: number;
}

export interface NotificationData {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
}

// API Response types
export interface ApiResponse<T = any> {
  data: T;
  message?: string;
  error?: string;
}

// Form configuration types
export interface ConfigFormValues {
  name?: string;
  chunk_size: number;
  llm_model: string;
  embedding_model: string;
  temperature: number;
}

// Component Props types
export interface ConfigFormProps {
  initialValues?: Partial<ConfigFormValues>;
  onSubmit: (config: ConfigFormValues) => void;
  onCancel?: () => void;
  submitLabel?: string;
  showNameField?: boolean;
  availableModels?: string[];
  disabled?: boolean;
}

export interface ServiceHealthCardProps {
  services: ServiceHealth[];
  overallStatus?: 'healthy' | 'degraded';
}

export interface FileTreeProps {
  files: FileMetadata[];
  bucketName: string;
  onDelete: (paths: string[]) => void;
  onView?: (filePath: string, fileName: string) => void;
}

export interface UploadPanelProps {
  bucketName: string;
  onUploadComplete?: () => void | Promise<void>;
}

export interface ChatMessageProps {
  message: ChatMessage;
}

export interface ChatSidebarProps {
  sessions: ChatSession[];
  currentSessionId: number | null;
  onSessionSelect: (sessionId: number) => void;
  onNewChat: () => void;
}
