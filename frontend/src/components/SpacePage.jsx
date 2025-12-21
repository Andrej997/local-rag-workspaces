import { useState } from 'react';
import { useIndexing } from '../context/IndexingContext';
import { bucketAPI, indexingAPI } from '../services/api';
import { useWebSocket } from '../hooks/useWebSocket';
import { ProgressDisplay } from './ProgressDisplay';

export function SpacePage() {
  const { state, refreshBuckets } = useIndexing();
  const { currentBucket, indexingStatus } = state;
  const [manualPath, setManualPath] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  // Activate WebSocket to listen for progress/errors
  useWebSocket();

  if (!currentBucket) {
    return <div className="card" style={{ padding: '2rem' }}>No space selected. Please create or select a space.</div>;
  }

  const handleStartIndexing = async () => {
    setIsStarting(true);
    try {
      await indexingAPI.start(currentBucket.name);
    } catch (err) {
      alert("Failed to start indexing: " + (err.response?.data?.detail || err.message));
    } finally {
      setIsStarting(false);
    }
  };

  const handleStopIndexing = async () => {
    try {
      await indexingAPI.stop();
    } catch (err) {
      alert("Failed to stop: " + err.message);
    }
  };

  const handleAddPath = async (e) => {
    e.preventDefault();
    if (!manualPath.trim()) return;

    setIsAdding(true);
    try {
      await bucketAPI.addDirectory(currentBucket.name, manualPath.trim());
      await refreshBuckets();
      setManualPath('');
    } catch (err) {
      alert("Error adding path: " + (err.response?.data?.detail || err.message));
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemoveDir = async (path) => {
    if (confirm(`Remove ${path} from index?`)) {
      await bucketAPI.removeDirectory(currentBucket.name, path);
      refreshBuckets();
    }
  };

  const isRunning = indexingStatus?.is_running;

  return (
    <div className="space-page" style={{ padding: '1.5rem', maxWidth: '1200px', margin: '0 auto' }}>

      {/* Header Section */}
      <div className="page-header" style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>{currentBucket.name}</h1>
          <div style={{ color: '#94a3b8' }}>
            Manage content sources and indexing
          </div>
        </div>

        {/* Indexing Status Badge */}
        <div style={{
          padding: '0.5rem 1rem',
          borderRadius: '2rem',
          background: isRunning ? 'rgba(16, 185, 129, 0.1)' : 'rgba(148, 163, 184, 0.1)',
          border: isRunning ? '1px solid #10b981' : '1px solid #475569',
          color: isRunning ? '#10b981' : '#94a3b8',
          display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: '500'
        }}>
          <div style={{
            width: '8px', height: '8px', borderRadius: '50%',
            background: isRunning ? '#10b981' : '#94a3b8',
            boxShadow: isRunning ? '0 0 8px #10b981' : 'none'
          }}></div>
          {isRunning ? 'Indexing in Progress' : 'Ready to Index'}
        </div>
      </div>

      <div style={{ display: 'grid', gap: '1.5rem', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))' }}>

        {/* LEFT COLUMN: Sources List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="card" style={{ padding: '1.5rem', flex: 1 }}>
            <h3 style={{ borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
              📂 Indexed Paths / Sources
            </h3>
            {currentBucket.directories.length === 0 ? (
              <p style={{ color: '#64748b', fontStyle: 'italic' }}>No sources added yet. Upload files or folders below.</p>
            ) : (
              <FileTree
                paths={currentBucket.directories}
                onDelete={(paths) => {
                  if (confirm(`Remove ${paths.length} item(s)?`)) {
                    bucketAPI.removeDirectories(currentBucket.name, paths)
                      .then(() => refreshBuckets())
                      .catch(err => alert("Failed to remove: " + err.message));
                  }
                }}
              />
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Controls, Progress & Add Path */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* Action Panel */}
          <div className="card" style={{ padding: '1.5rem', background: 'rgba(59, 130, 246, 0.05)', borderColor: 'rgba(59, 130, 246, 0.2)' }}>
            <h3 style={{ marginBottom: '1rem', color: 'var(--accent)' }}>⚡ Actions</h3>

            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
              {!isRunning ? (
                <button
                  onClick={handleStartIndexing}
                  disabled={isStarting || currentBucket.directories.length === 0}
                  style={{
                    flex: 1, padding: '0.75rem', borderRadius: '0.5rem', border: 'none',
                    background: 'var(--accent)', color: 'white', fontWeight: 'bold', cursor: 'pointer',
                    opacity: (isStarting || currentBucket.directories.length === 0) ? 0.6 : 1
                  }}
                >
                  {isStarting ? 'Starting...' : 'Start Indexing'}
                </button>
              ) : (
                <button
                  onClick={handleStopIndexing}
                  style={{
                    flex: 1, padding: '0.75rem', borderRadius: '0.5rem', border: 'none',
                    background: '#ef4444', color: 'white', fontWeight: 'bold', cursor: 'pointer'
                  }}
                >
                  Stop Indexing
                </button>
              )}
            </div>

            {/* PROGRESS DISPLAY COMPONENT */}
            <div style={{ background: 'var(--bg-primary)', borderRadius: '0.5rem', border: '1px solid var(--border)', minHeight: '100px' }}>
              <ProgressDisplay />
            </div>
          </div>

          {/* Upload Panel */}
          <div className="card" style={{ padding: '1.5rem' }}>
            <h3 style={{ marginBottom: '1rem' }}>☁️ Upload to MinIO & Index</h3>

            <div style={{ display: 'flex', gap: '1rem', flexDirection: 'column' }}>

              {/* Directory Upload */}
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.9rem' }}>Upload Folder</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    type="file"
                    webkitdirectory=""
                    directory=""
                    multiple
                    onChange={async (e) => {
                      if (!e.target.files.length) return;
                      const formData = new FormData();
                      for (let i = 0; i < e.target.files.length; i++) {
                        formData.append('files', e.target.files[i]);
                      }

                      setIsAdding(true);
                      try {
                        const res = await import('../services/api').then(m => m.uploadAPI.upload(currentBucket.name, formData));
                        alert(res.data.message);
                        await refreshBuckets();
                      } catch (err) {
                        alert("Upload failed: " + (err.response?.data?.detail || err.message));
                      } finally {
                        setIsAdding(false);
                        e.target.value = null; // reset
                      }
                    }}
                    style={{ flex: 1 }}
                  />
                </div>
              </div>

              {/* Files Upload */}
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.9rem' }}>Upload Files</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    type="file"
                    multiple
                    onChange={async (e) => {
                      if (!e.target.files.length) return;
                      const formData = new FormData();
                      for (let i = 0; i < e.target.files.length; i++) {
                        formData.append('files', e.target.files[i]);
                      }

                      setIsAdding(true);
                      try {
                        const res = await import('../services/api').then(m => m.uploadAPI.upload(currentBucket.name, formData));
                        alert(res.data.message);
                        await refreshBuckets();
                      } catch (err) {
                        alert("Upload failed: " + (err.response?.data?.detail || err.message));
                      } finally {
                        setIsAdding(false);
                        e.target.value = null;
                      }
                    }}
                    style={{ flex: 1 }}
                  />
                </div>
              </div>

              {isAdding && <p style={{ color: 'var(--accent)', fontSize: '0.9rem' }}>Uploading... please wait.</p>}

            </div>
          </div>

        </div>

      </div>
    </div>
  );
}

// Helper to build tree from paths
function buildTree(paths) {
  const root = {};
  paths.forEach(path => {
    // Normalize path separators
    const parts = path.split(/[/\\]/).filter(p => p);
    let current = root;
    parts.forEach((part, i) => {
      if (!current[part]) {
        current[part] = {
          __files__: [],
          __fullPath__: i === parts.length - 1 ? path : null
        };
      }
      current = current[part];
    });
  });
  return root;
}

function FileTree({ paths, onDelete }) {
  // Simple recursive tree rendering
  // We need to group common prefixes relative to the shortest common prefix?
  // Or just naïve tree.

  // Naïve tree might be too deep if all paths are /app/data/uploads/...
  // Let's find common prefix first?
  // For now, let's just render the tree structure as is, or maybe just flat list if tree is too complex.
  // Actually, user asked for "list all files... be able to delete sub files or sub folders".

  const structure = {};

  // Identify common prefix to strip?
  // We want to strip '/app/data/uploads/<space-name>/'
  // But wait, the path might be just '/workspace' if manually added.
  // Strategy: If path contains '/data/uploads/', strip everything up to and including the bucket folder.

  paths.forEach(path => {
    let displayPath = path;

    // Normalize slashes
    const normalized = path.replace(/\\/g, '/');

    // Check for explicit 'uploads/' prefix (MinIO structure)
    if (normalized.startsWith('uploads/')) {
      displayPath = normalized.substring('uploads/'.length);
    }
    // Fallback logic for legacy paths (if any)
    else {
      const match = normalized.match(/\/data\/uploads\/[^/]+\/(.*)/);
      if (match) {
        displayPath = match[1];
      }
    }

    // Split path into parts
    const parts = displayPath.split(/[/\\]/).filter(p => p);
    let current = structure;
    parts.forEach((part, index) => {
      if (!current[part]) {
        current[part] = { _children: {}, _path: null };
      }
      if (index === parts.length - 1) {
        current[part]._path = path; // STORE ORIGINAL FULL PATH for deletion
      }
      current = current[part]._children;
    });
  });

  const renderNode = (node, name, fullPath) => {
    const childrenKeys = Object.keys(node._children);
    const isFile = !!node._path;
    const hasChildren = childrenKeys.length > 0;

    // Determine full paths of all descendants (for folder deletion)
    const collectPaths = (n) => {
      let p = n._path ? [n._path] : [];
      Object.values(n._children).forEach(child => {
        p = [...p, ...collectPaths(child)];
      });
      return p;
    };

    const handleDelete = () => {
      // If it's a folder, delete all descendants. If file, just self.
      const pathsToDelete = node._path ? [node._path] : [];
      if (hasChildren) {
        Object.values(node._children).forEach(child => {
          pathsToDelete.push(...collectPaths(child));
        });
      }
      // Deduplicate
      const uniquePaths = [...new Set(pathsToDelete)];
      onDelete(uniquePaths);
    };

    return (
      <li key={name} style={{ marginLeft: '1.5rem', listStyle: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '2px 0' }}>
          <span style={{ color: hasChildren ? '#fbbf24' : '#94a3b8' }}>{hasChildren ? '📁' : '📄'}</span>
          <span style={{ color: '#e2e8f0', fontSize: '0.9rem' }}>{name}</span>
          <button
            onClick={handleDelete}
            style={{
              marginLeft: 'auto', color: '#ef4444', background: 'none', border: 'none',
              cursor: 'pointer', fontSize: '1rem', padding: '0 4px'
            }}
            title={hasChildren ? "Delete folder" : "Delete file"}
          >
            ✕
          </button>
        </div>
        {hasChildren && (
          <ul style={{ padding: 0, margin: 0 }}>
            {childrenKeys.map(key => renderNode(node._children[key], key))}
          </ul>
        )}
      </li>
    );
  };

  return (
    <ul style={{ padding: '0.5rem', margin: 0, overflowX: 'auto' }}>
      {Object.keys(structure).map(key => renderNode(structure[key], key))}
    </ul>
  );
}