import { useState, useEffect } from 'react';
import { useIndexing } from '../context/IndexingContext';
import { useNotification } from '../context/NotificationContext';
import { bucketAPI, statsAPI } from '../services/api';
import { ConfigForm } from './ConfigForm';
import { GuideModal } from './GuideModal';

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
        temperature: config.temperature,
        top_k: config.top_k,
        enable_reranking: config.enable_reranking,
        enable_hybrid_search: config.enable_hybrid_search
      });
      await refreshBuckets(); // Refresh context
      notify.success(`Settings for "${currentBucket.name}" saved!`);
    } catch (err) {
      notify.error('Failed to save space settings: ' + err.message);
    } finally {
      setIsSavingSpace(false);
    }
  };

  const guideContent = {
    title: "Settings Guide",
    sections: [
      {
        icon: "🔧",
        title: "Space Configuration",
        color: "#3b82f6",
        description: "Fine-tune RAG parameters for each space:",
        items: [
          { label: "Chunk Size", text: "Number of characters per document chunk (affects context granularity)" },
          { label: "LLM Model", text: "Language model for generating responses (e.g., llama3.2, mistral)" },
          { label: "Embedding Model", text: "Model for vectorizing text (e.g., nomic-embed-text, all-minilm)" },
          { label: "Temperature", text: "Controls randomness (0.0 = deterministic, 1.0 = creative)" },
          { label: "Top K", text: "Number of document chunks to retrieve for context" }
        ]
      },
      {
        icon: "⚡",
        title: "Performance Settings",
        color: "#8b5cf6",
        description: "Trade-offs between speed and accuracy:",
        items: [
          { label: "Reranking", text: "Cross-encoder reranking improves accuracy but adds latency" },
          { label: "Hybrid Search", text: "Combines vector + BM25 keyword search for better recall" },
          { label: "Faster Mode", text: "Disable reranking and hybrid search for quicker responses" }
        ]
      },
      {
        icon: "🎯",
        title: "Best Practices",
        color: "#10b981",
        steps: [
          { label: "Chunk Size", text: "Smaller (500-800) for precise answers, larger (1000-2000) for broader context" },
          { label: "Model Selection", text: "Faster models (llama3.2) for quick responses, larger models for complex tasks" },
          { label: "Temperature", text: "Lower (0.1-0.3) for factual Q&A, higher (0.7-0.9) for creative writing" },
          { label: "Re-index After", text: "Changes to chunk size or embedding model require re-indexing" }
        ]
      },
      {
        icon: "⚙️",
        title: "Model Detection",
        color: "#f59e0b",
        description: "The system auto-detects installed Ollama models. If you see a warning:",
        items: [
          { label: "Check Ollama", text: "Ensure Ollama service is running (ollama serve)" },
          { label: "Install Models", text: "Download models with 'ollama pull <model-name>'" },
          { label: "Refresh Page", text: "Reload after installing new models" }
        ]
      },
      {
        icon: "🚨",
        title: "Danger Zone",
        color: "#ef4444",
        description: "Irreversible actions require caution:",
        items: [
          { label: "Delete Space", text: "Permanently removes all files, embeddings, and chat history" },
          { label: "No Undo", text: "Deletion cannot be reversed - backup important data first" },
          { label: "Confirmation", text: "System will ask for confirmation before proceeding" }
        ]
      }
    ]
  };

  return (
    <div className="settings-page" style={{ padding: '1.5rem', maxWidth: '800px' }}>
      <div className="page-header" style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 'bold', margin: 0, marginBottom: '0.5rem' }}>Settings</h1>
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>Configure system defaults and space-specific parameters.</p>
        </div>
        <GuideModal title={guideContent.title} sections={guideContent.sections} />
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
                temperature: currentBucket.config?.temperature || 0.7,
                top_k: currentBucket.config?.top_k || 5,
                enable_reranking: currentBucket.config?.enable_reranking ?? true,
                enable_hybrid_search: currentBucket.config?.enable_hybrid_search ?? true
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