import { useState } from 'react';
import { bucketAPI } from '../services/api';
import { useIndexing } from '../context/IndexingContext';
import { useNotification } from '../context/NotificationContext';
import { ConfigForm } from './ConfigForm';

export function BucketManager() {
  const { state, refreshBuckets } = useIndexing();
  const { notify } = useNotification();
  const { buckets, currentBucket } = state;
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async (config) => {
    if (!config.name || !config.name.trim()) {
      notify.error("Space name is required");
      return;
    }

    try {
      await bucketAPI.createBucket(config.name, {
        chunk_size: config.chunk_size,
        llm_model: config.llm_model,
        embedding_model: config.embedding_model,
        temperature: config.temperature
      });

      setIsCreating(false);
      refreshBuckets();
      notify.success(`Space "${config.name}" created successfully!`);
    } catch (err) {
      notify.error("Failed to create space: " + err.message);
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
          <div style={{ marginTop: '0.5rem' }}>
            <h4 style={{ margin: '0 0 0.75rem 0' }}>Create New Space</h4>
            <ConfigForm
              initialValues={{
                name: '',
                chunk_size: 1000,
                llm_model: 'llama3.2',
                embedding_model: 'nomic-embed-text',
                temperature: 0.7
              }}
              onSubmit={handleCreate}
              onCancel={() => setIsCreating(false)}
              submitLabel="Create"
              showNameField={true}
            />
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