import { useState, useEffect } from 'react';
import { useIndexing } from '../context/IndexingContext';
import { useNotification } from '../context/NotificationContext';
import { bucketAPI, statsAPI } from '../services/api';
import { ConfigForm } from './ConfigForm';

export function SettingsPage() {
  const { state, refreshBuckets } = useIndexing();
  const { notify } = useNotification();
  const { currentBucket } = state;

  // Available Ollama Models
  const [availableModels, setAvailableModels] = useState([]);
  const [isSavingSpace, setIsSavingSpace] = useState(false);



  // Load available Ollama models on mount
  useEffect(() => {
    loadAvailableModels();
  }, []);

  const loadAvailableModels = async () => {
    try {
      const res = await statsAPI.getOllamaModels();
      setAvailableModels(res.data.models || []);
    } catch (err) {
      console.error("Failed to load available models", err);
    }
  };

  const handleSaveSpace = async (config) => {
    if (!currentBucket) return;
    setIsSavingSpace(true);
    try {
      await bucketAPI.updateConfig(currentBucket.name, {
        chunk_size: config.chunk_size,
        llm_model: config.llm_model,
        embedding_model: config.embedding_model,
        temperature: config.temperature
      });
      await refreshBuckets(); // Refresh context
      notify.success(`Settings for "${currentBucket.name}" saved!`);
    } catch (err) {
      notify.error('Failed to save space settings: ' + err.message);
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
            {/* Ollama Models Detection Warning */}
            {availableModels.length === 0 && (
              <div style={{
                fontSize: '0.85rem',
                color: '#f59e0b',
                marginBottom: '1rem',
                padding: '0.75rem',
                background: 'rgba(245, 158, 11, 0.1)',
                borderRadius: '0.375rem',
                border: '1px solid rgba(245, 158, 11, 0.3)'
              }}>
                ⚠️ Could not detect installed Ollama models. Make sure Ollama is running.
                {availableModels.length > 0 && (
                  <span style={{ marginLeft: '0.5rem', color: '#10b981' }}>
                    ({availableModels.length} models detected)
                  </span>
                )}
              </div>
            )}

            <ConfigForm
              initialValues={{
                chunk_size: currentBucket.config?.chunk_size || 1000,
                llm_model: currentBucket.config?.llm_model || 'llama3.2',
                embedding_model: currentBucket.config?.embedding_model || 'nomic-embed-text',
                temperature: currentBucket.config?.temperature || 0.7
              }}
              onSubmit={handleSaveSpace}
              submitLabel={isSavingSpace ? 'Saving Changes...' : 'Save Configuration'}
              showNameField={false}
              availableModels={availableModels.map(m => m.name)}
              disabled={isSavingSpace}
            />

            {/* Destructive Actions Section */}
            <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)' }}>
              <h4 style={{ color: '#ef4444', marginBottom: '0.75rem', fontSize: '0.9rem' }}>Danger Zone</h4>
              <button
                onClick={async () => {
                  if (confirm(`Are you sure you want to delete space "${currentBucket.name}"? This cannot be undone.`)) {
                    try {
                      await bucketAPI.deleteBucket(currentBucket.name);
                      notify.success("Space deleted successfully");
                      await refreshBuckets();
                    } catch (e) {
                      notify.error("Failed to delete space: " + e.message);
                    }
                  }
                }}
                style={{
                  background: 'none',
                  color: '#ef4444',
                  border: '1px solid #ef4444',
                  borderRadius: '0.5rem',
                  padding: '0.75rem 1.5rem',
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
              >
                Delete Space
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}