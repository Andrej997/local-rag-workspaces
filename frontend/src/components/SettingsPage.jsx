import { useState, useEffect } from 'react';
import { useIndexing } from '../context/IndexingContext';
import { bucketAPI } from '../services/api';

export function SettingsPage() {
  const { state, refreshBuckets } = useIndexing();
  const { currentBucket } = state;



  // Space Settings State
  const [chunkSize, setChunkSize] = useState(1000);
  const [llmModel, setLlmModel] = useState('llama3.2');
  const [embeddingModel, setEmbeddingModel] = useState('nomic-embed-text');
  const [temperature, setTemperature] = useState(0.7);
  const [isSavingSpace, setIsSavingSpace] = useState(false);



  // Update form when current bucket changes
  useEffect(() => {
    if (currentBucket && currentBucket.config) {
      setChunkSize(currentBucket.config.chunk_size || 1000);
      setLlmModel(currentBucket.config.llm_model || 'llama3.2');
      setEmbeddingModel(currentBucket.config.embedding_model || 'nomic-embed-text');
      setTemperature(currentBucket.config.temperature || 0.7);
    }
  }, [currentBucket]);



  const handleSaveSpace = async () => {
    if (!currentBucket) return;
    setIsSavingSpace(true);
    try {
      await bucketAPI.updateConfig(currentBucket.name, {
        chunk_size: parseInt(chunkSize),
        llm_model: llmModel,
        embedding_model: embeddingModel,
        temperature: parseFloat(temperature)
      });
      await refreshBuckets(); // Refresh context
      alert(`Settings for "${currentBucket.name}" saved!`);
    } catch (err) {
      alert('Failed to save space settings: ' + err.message);
    } finally {
      setIsSavingSpace(false);
    }
  };

  return (
    <div className="settings-page" style={{ padding: '1.5rem', maxWidth: '800px' }}>
      <div className="page-header" style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.8rem', fontWeight: 'bold' }}>Settings</h1>
        <p style={{ color: 'var(--text-muted)' }}>Configure system defaults and space-specific parameters.</p>
      </div>



      {/* Space Configuration Section */}
      <div className="card" style={{ padding: '1.5rem' }}>
        <h3 style={{ borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
          🚀 Space Configuration: <span style={{ color: 'var(--accent)' }}>{currentBucket ? currentBucket.name : 'None Selected'}</span>
        </h3>

        {!currentBucket ? (
          <p style={{ color: 'var(--text-muted)' }}>Select a space from the sidebar to configure it.</p>
        ) : (
          <div className="space-settings-form">
            <div className="form-group" style={{ marginBottom: '1.2rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>LLM Model</label>
              <select
                value={llmModel}
                onChange={(e) => setLlmModel(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  fontSize: '1rem',
                  borderRadius: '0.375rem',
                  border: '1px solid var(--border)',
                  background: 'white',
                  cursor: 'pointer'
                }}
              >
                <option value="llama3.3">llama3.3</option>
                <option value="llama3.2">llama3.2</option>
                <option value="llama3.1">llama3.1</option>
                <option value="llama3">llama3</option>
                <option value="mistral">mistral</option>
                <option value="gpt-oss">gpt-oss</option>
                <option value="deepseek-r1">deepseek-r1</option>
              </select>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                The Ollama model to use for chat (must be pulled in Ollama).
              </p>
            </div>

            <div className="form-group" style={{ marginBottom: '1.2rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Embedding Model</label>
              <select
                value={embeddingModel}
                onChange={(e) => setEmbeddingModel(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  fontSize: '1rem',
                  borderRadius: '0.375rem',
                  border: '1px solid var(--border)',
                  background: 'white',
                  cursor: 'pointer'
                }}
              >
                <option value="nomic-embed-text">nomic-embed-text (768 dim)</option>
                <option value="mxbai-embed-large">mxbai-embed-large (1024 dim)</option>
                <option value="all-minilm">all-minilm (384 dim)</option>
              </select>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                The embedding model for vector search. <strong>Requires re-indexing to apply.</strong>
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              <div className="form-group">
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Temperature ({temperature})</label>
                <input
                  type="range"
                  min="0" max="1" step="0.1"
                  value={temperature}
                  onChange={(e) => setTemperature(e.target.value)}
                  style={{ width: '100%', cursor: 'pointer' }}
                />
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  Lower is more precise, higher is more creative.
                </p>
              </div>

              <div className="form-group">
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Chunk Size</label>
                <input
                  type="number"
                  value={chunkSize}
                  onChange={(e) => setChunkSize(e.target.value)}
                  min="100" max="5000"
                  style={{ width: '100%' }}
                />
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  Characters per vector chunk. <strong>Requires re-indexing to apply.</strong>
                </p>
              </div>
            </div>

            <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: '1.5rem' }}>
              <button
                onClick={async () => {
                  if (confirm(`Are you sure you want to delete space "${currentBucket.name}"? This cannot be undone.`)) {
                    try {
                      await bucketAPI.deleteBucket(currentBucket.name);
                      alert("Space deleted.");
                      await refreshBuckets();
                    } catch (e) {
                      alert("Failed to delete space: " + e.message);
                    }
                  }
                }}
                style={{
                  background: 'none', color: '#ef4444', border: '1px solid #ef4444',
                  borderRadius: '0.5rem', padding: '0.75rem 1.5rem', fontWeight: 'bold', cursor: 'pointer'
                }}
              >
                Delete Space
              </button>

              <button
                onClick={handleSaveSpace}
                disabled={isSavingSpace}
                style={{
                  background: 'var(--accent)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.5rem',
                  padding: '0.75rem 2rem',
                  fontWeight: 'bold',
                  fontSize: '1rem'
                }}
              >
                {isSavingSpace ? 'Saving Changes...' : 'Save Configuration'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}