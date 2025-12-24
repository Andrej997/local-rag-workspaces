import { useState, useEffect, FormEvent } from 'react';
import { ConfigFormProps, ConfigFormValues } from '../types';

/**
 * Reusable Configuration Form Component
 * Used for both creating and editing space configurations
 */
export function ConfigForm({
  initialValues = {},
  onSubmit,
  onCancel,
  submitLabel = 'Save',
  showNameField = false,
  availableModels = [],
  disabled = false
}: ConfigFormProps) {
  const [name, setName] = useState<string>(initialValues.name || '');
  const [chunkSize, setChunkSize] = useState<number>(initialValues.chunk_size || 1000);
  const [llmModel, setLlmModel] = useState<string>(initialValues.llm_model || 'llama3.2');
  const [embeddingModel, setEmbeddingModel] = useState<string>(initialValues.embedding_model || 'nomic-embed-text');
  const [temperature, setTemperature] = useState<number>(initialValues.temperature || 0.7);
  // RAG performance settings
  const [topK, setTopK] = useState<number>(initialValues.top_k || 5);
  const [enableReranking, setEnableReranking] = useState<boolean>(initialValues.enable_reranking ?? true);
  const [enableHybridSearch, setEnableHybridSearch] = useState<boolean>(initialValues.enable_hybrid_search ?? true);

  // Update form when initialValues change
  useEffect(() => {
    if (initialValues.name !== undefined) setName(initialValues.name);
    if (initialValues.chunk_size !== undefined) setChunkSize(initialValues.chunk_size);
    if (initialValues.llm_model !== undefined) setLlmModel(initialValues.llm_model);
    if (initialValues.embedding_model !== undefined) setEmbeddingModel(initialValues.embedding_model);
    if (initialValues.temperature !== undefined) setTemperature(initialValues.temperature);
    if (initialValues.top_k !== undefined) setTopK(initialValues.top_k);
    if (initialValues.enable_reranking !== undefined) setEnableReranking(initialValues.enable_reranking);
    if (initialValues.enable_hybrid_search !== undefined) setEnableHybridSearch(initialValues.enable_hybrid_search);
  }, [initialValues]);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const config: ConfigFormValues = {
      chunk_size: typeof chunkSize === 'string' ? parseInt(chunkSize) : chunkSize,
      llm_model: llmModel,
      embedding_model: embeddingModel,
      temperature: typeof temperature === 'string' ? parseFloat(temperature) : temperature,
      top_k: typeof topK === 'string' ? parseInt(topK) : topK,
      enable_reranking: enableReranking,
      enable_hybrid_search: enableHybridSearch
    };

    if (showNameField) {
      config.name = name;
    }

    onSubmit(config);
  };

  // LLM Model options
  const llmModelOptions = availableModels.length > 0
    ? availableModels.map(model => ({ value: model, label: model }))
    : [
        { value: 'llama3.3', label: 'llama3.3' },
        { value: 'llama3.2', label: 'llama3.2' },
        { value: 'llama3.1', label: 'llama3.1' },
        { value: 'llama3', label: 'llama3' },
        { value: 'mistral:7b', label: 'mistral:7b' },
        { value: 'gpt-oss:20b', label: 'gpt-oss:20b' },
        { value: 'deepseek-r1:8b', label: 'deepseek-r1:8b' }
      ];

  // Embedding Model options
  const embeddingModelOptions = [
    { value: 'nomic-embed-text', label: 'nomic-embed-text (768 dim)' },
    { value: 'mxbai-embed-large', label: 'mxbai-embed-large (1024 dim)' },
    { value: 'all-minilm', label: 'all-minilm (384 dim)' }
  ];

  return (
    <form onSubmit={handleSubmit} style={{
      background: 'rgba(255,255,255,0.05)',
      padding: '1rem',
      borderRadius: '8px'
    }}>
      {showNameField && (
        <>
          <label style={{ display: 'block', marginBottom: '0.2rem', fontSize: '0.85rem' }}>
            Name
          </label>
          <input
            type="text"
            placeholder="Space Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            style={{ width: '100%', marginBottom: '0.75rem' }}
          />
        </>
      )}

      <label style={{ display: 'block', marginBottom: '0.2rem', fontSize: '0.85rem' }}>
        Chunk Size (characters)
      </label>
      <input
        type="number"
        value={chunkSize}
        onChange={(e) => setChunkSize(parseInt(e.target.value) || 0)}
        min="100"
        max="5000"
        style={{ width: '100%', marginBottom: '0.75rem' }}
      />
      <div style={{ fontSize: '0.7rem', color: '#6b7280', marginTop: '-0.5rem', marginBottom: '0.75rem' }}>
        Recommended: 500-2000 characters
      </div>

      <label style={{ display: 'block', marginBottom: '0.2rem', fontSize: '0.85rem' }}>
        LLM Model
      </label>
      <select
        value={llmModel}
        onChange={(e) => setLlmModel(e.target.value)}
        style={{ width: '100%', marginBottom: '0.75rem', padding: '0.4rem', cursor: 'pointer' }}
      >
        {llmModelOptions.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      <label style={{ display: 'block', marginBottom: '0.2rem', fontSize: '0.85rem' }}>
        Embedding Model
      </label>
      <select
        value={embeddingModel}
        onChange={(e) => setEmbeddingModel(e.target.value)}
        style={{ width: '100%', marginBottom: '0.75rem', padding: '0.4rem', cursor: 'pointer' }}
      >
        {embeddingModelOptions.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      <label style={{ display: 'block', marginBottom: '0.2rem', fontSize: '0.85rem' }}>
        Temperature (0-2)
      </label>
      <input
        type="number"
        value={temperature}
        onChange={(e) => setTemperature(parseFloat(e.target.value) || 0)}
        step="0.1"
        min="0"
        max="2"
        style={{ width: '100%', marginBottom: '0.75rem' }}
      />
      <div style={{ fontSize: '0.7rem', color: '#6b7280', marginTop: '-0.5rem', marginBottom: '1rem' }}>
        Lower = more focused, Higher = more creative
      </div>

      {/* RAG Performance Settings */}
      <div style={{
        marginTop: '1rem',
        paddingTop: '1rem',
        borderTop: '1px solid rgba(255,255,255,0.1)',
        marginBottom: '1rem'
      }}>
        <div style={{ fontSize: '0.9rem', fontWeight: '500', marginBottom: '0.75rem', color: 'var(--text-secondary)' }}>
          Retrieval Settings
        </div>

        <label style={{ display: 'block', marginBottom: '0.2rem', fontSize: '0.85rem' }}>
          Top K Results (1-20)
        </label>
        <input
          type="number"
          value={topK}
          onChange={(e) => setTopK(parseInt(e.target.value) || 5)}
          min="1"
          max="20"
          style={{ width: '100%', marginBottom: '0.75rem' }}
        />
        <div style={{ fontSize: '0.7rem', color: '#6b7280', marginTop: '-0.5rem', marginBottom: '0.75rem' }}>
          Number of document chunks to retrieve
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <input
            type="checkbox"
            id="enableReranking"
            checked={enableReranking}
            onChange={(e) => setEnableReranking(e.target.checked)}
            style={{ width: 'auto', cursor: 'pointer' }}
          />
          <label htmlFor="enableReranking" style={{ fontSize: '0.85rem', cursor: 'pointer' }}>
            Enable Reranking
          </label>
        </div>
        <div style={{ fontSize: '0.7rem', color: '#6b7280', marginBottom: '0.75rem', marginLeft: '1.5rem' }}>
          Cross-encoder reranking (slower but more accurate)
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <input
            type="checkbox"
            id="enableHybridSearch"
            checked={enableHybridSearch}
            onChange={(e) => setEnableHybridSearch(e.target.checked)}
            style={{ width: 'auto', cursor: 'pointer' }}
          />
          <label htmlFor="enableHybridSearch" style={{ fontSize: '0.85rem', cursor: 'pointer' }}>
            Enable Hybrid Search
          </label>
        </div>
        <div style={{ fontSize: '0.7rem', color: '#6b7280', marginBottom: '1rem', marginLeft: '1.5rem' }}>
          Combine vector search with BM25 keyword search
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button
          type="submit"
          disabled={disabled}
          style={{
            flex: 1,
            background: 'var(--accent)',
            color: 'white',
            border: 'none',
            padding: '0.5rem',
            borderRadius: '4px',
            cursor: disabled ? 'not-allowed' : 'pointer',
            fontWeight: '500',
            opacity: disabled ? 0.6 : 1
          }}
        >
          {submitLabel}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            style={{
              flex: 1,
              background: 'transparent',
              border: '1px solid #666',
              color: '#ccc',
              padding: '0.5rem',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
