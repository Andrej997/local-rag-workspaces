import { useState } from 'react';
import { bucketAPI } from '../services/api';
import { useIndexing } from '../context/IndexingContext';

export function BucketManager() {
  const { state, refreshBuckets } = useIndexing();
  const { buckets, currentBucket } = state;
  const [isCreating, setIsCreating] = useState(false);
  
  // Form State
  const [newBucketName, setNewBucketName] = useState('');
  const [chunkSize, setChunkSize] = useState(1000);
  const [llmModel, setLlmModel] = useState('llama3.2');
  const [embeddingModel, setEmbeddingModel] = useState('nomic-embed-text');
  const [temperature, setTemperature] = useState(0.7);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newBucketName.trim()) return;

    try {
      await bucketAPI.createBucket(newBucketName, {
        chunk_size: parseInt(chunkSize),
        llm_model: llmModel,
        embedding_model: embeddingModel,
        temperature: parseFloat(temperature)
      });
      setNewBucketName('');
      // Reset defaults
      setChunkSize(1000);
      setLlmModel('llama3.2');
      setEmbeddingModel('nomic-embed-text');
      setTemperature(0.7);

      setIsCreating(false);
      refreshBuckets();
    } catch (err) {
      alert("Failed to create space: " + err.message);
    }
  };

  const handleSelect = async (name) => {
    try {
      await bucketAPI.selectBucket(name);
      refreshBuckets();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="bucket-manager">
      <div className="bucket-header" style={{ marginBottom: '1rem' }}>
        <select 
          value={currentBucket?.name || ''} 
          onChange={(e) => handleSelect(e.target.value)}
          style={{ width: '100%', marginBottom: '0.5rem' }}
        >
          {buckets.length > 0 ? (
            buckets.map(b => (
              <option key={b.name} value={b.name}>{b.name}</option>
            ))
          ) : (
             <option value="" disabled>No spaces found</option>
          )}
        </select>
        
        {!isCreating ? (
          <button 
            onClick={() => setIsCreating(true)}
            style={{ width: '100%', padding: '0.5rem', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: '4px' }}
          >
            + New Space
          </button>
        ) : (
          <div className="create-form" style={{ background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '8px', marginTop: '0.5rem' }}>
            <h4 style={{ margin: '0 0 0.5rem 0' }}>Create New Space</h4>
            
            <label style={{ display: 'block', marginBottom: '0.2rem', fontSize: '0.85rem' }}>Name</label>
            <input 
              type="text" 
              placeholder="Project Name" 
              value={newBucketName}
              onChange={(e) => setNewBucketName(e.target.value)}
              style={{ width: '100%', marginBottom: '0.5rem' }}
            />

            <label style={{ display: 'block', marginBottom: '0.2rem', fontSize: '0.85rem' }}>Chunk Size (chars)</label>
            <input 
              type="number" 
              value={chunkSize}
              onChange={(e) => setChunkSize(e.target.value)}
              min="100" max="5000"
              style={{ width: '100%', marginBottom: '0.5rem' }}
            />

            <label style={{ display: 'block', marginBottom: '0.2rem', fontSize: '0.85rem' }}>LLM Model</label>
            <select
              value={llmModel}
              onChange={(e) => setLlmModel(e.target.value)}
              style={{ width: '100%', marginBottom: '0.5rem', padding: '0.25rem', cursor: 'pointer' }}
            >
              <option value="llama3.3">llama3.3</option>
              <option value="llama3.2">llama3.2</option>
              <option value="llama3.1">llama3.1</option>
              <option value="llama3">llama3</option>
              <option value="mistral:7b">mistral:7b</option>
              <option value="gpt-oss:20b">gpt-oss:20b</option>
              <option value="deepseek-r1:8b">deepseek-r1:8b</option>
            </select>

            <label style={{ display: 'block', marginBottom: '0.2rem', fontSize: '0.85rem' }}>Embedding Model</label>
            <select
              value={embeddingModel}
              onChange={(e) => setEmbeddingModel(e.target.value)}
              style={{ width: '100%', marginBottom: '0.5rem', padding: '0.25rem', cursor: 'pointer' }}
            >
              <option value="nomic-embed-text">nomic-embed-text (768 dim)</option>
              <option value="mxbai-embed-large">mxbai-embed-large (1024 dim)</option>
              <option value="all-minilm">all-minilm (384 dim)</option>
            </select>

            <label style={{ display: 'block', marginBottom: '0.2rem', fontSize: '0.85rem' }}>Temperature (0-1)</label>
            <input 
              type="number" 
              value={temperature}
              onChange={(e) => setTemperature(e.target.value)}
              step="0.1" min="0" max="1"
              style={{ width: '100%', marginBottom: '1rem' }}
            />

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={handleCreate} style={{ flex: 1, background: 'var(--accent)', color: 'white', border: 'none', padding: '0.5rem', borderRadius: '4px' }}>Create</button>
              <button onClick={() => setIsCreating(false)} style={{ flex: 1, background: 'transparent', border: '1px solid #666', color: '#ccc', padding: '0.5rem', borderRadius: '4px' }}>Cancel</button>
            </div>
          </div>
        )}
      </div>

      {currentBucket && currentBucket.config && (
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', padding: '0.5rem', borderTop: '1px solid var(--border)' }}>
          <div><strong>Settings:</strong></div>
          <div>Chunk Size: {currentBucket.config.chunk_size}</div>
          <div>Model: {currentBucket.config.llm_model}</div>
          <div>Temp: {currentBucket.config.temperature}</div>
        </div>
      )}
    </div>
  );
}