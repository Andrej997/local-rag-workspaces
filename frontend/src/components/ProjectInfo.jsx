import { bucketAPI } from '../services/api';
import { useIndexing } from '../context/IndexingContext';

export function ProjectInfo() {
  const { state, refreshBucket } = useIndexing();
  const { currentBucket } = state;

  if (!currentBucket) return null;

  return (
    <div className="project-info">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ marginTop: 0, marginBottom: 0, color: '#1f2937' }}>
          Indexed Directories
        </h3>
        <span style={{ fontSize: '0.85rem', color: '#6b7280', background: '#f3f4f6', padding: '2px 8px', borderRadius: '12px' }}>
          {currentBucket.directories.length} sources
        </span>
      </div>

      {currentBucket.directories.length === 0 ? (
        <div style={{ padding: '1rem', background: '#f9fafb', borderRadius: '0.5rem', border: '1px dashed #e5e7eb', textAlign: 'center', color: '#9ca3af', fontSize: '0.9rem' }}>
          No directories added yet. Use the File Browser below to add code.
        </div>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {currentBucket.directories.map(dir => (
            <li key={dir} style={{ 
              background: 'white', padding: '0.75rem', marginBottom: '0.5rem', 
              borderRadius: '0.375rem', border: '1px solid #e5e7eb', 
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
              fontSize: '0.9rem' 
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                <span style={{ fontSize: '1.1rem' }}>📂</span>
                <span style={{ fontFamily: 'monospace', color: '#374151', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                  {dir}
                </span>
              </div>
              <button 
                onClick={() => bucketAPI.removeDirectory(currentBucket.name, dir).then(refreshBucket)}
                style={{ 
                  background: 'none', border: 'none', color: '#ef4444', 
                  cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center',
                  opacity: 0.7, transition: 'opacity 0.2s'
                }}
                title="Remove directory"
                onMouseOver={(e) => e.currentTarget.style.opacity = 1}
                onMouseOut={(e) => e.currentTarget.style.opacity = 0.7}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}