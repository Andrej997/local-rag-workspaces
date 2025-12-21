import { useState, useEffect } from 'react';
import { browseAPI } from '../services/api';

export function DirectoryBrowser({ onSelect }) {
  const [currentPath, setCurrentPath] = useState('/workspace');
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedPaths, setSelectedPaths] = useState(new Set());

  const loadDirectory = async (path) => {
    setLoading(true);
    try {
      const res = await browseAPI.browse(path);
      // Backend should return { path, entries: [{name, type, path}, ...] }
      // Adapting to likely backend response structure
      if (res.data) {
        setCurrentPath(res.data.current_path || path);
        setEntries(res.data.items || []);
      }
    } catch (err) {
      console.error("Failed to load directory", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDirectory(currentPath);
  }, []);

  const handleNavigate = (path) => {
    loadDirectory(path);
  };

  const handleUp = () => {
    // Simple parent directory logic
    const parent = currentPath.split('/').slice(0, -1).join('/') || '/';
    loadDirectory(parent);
  };

  const toggleSelection = (path) => {
    setSelectedPaths(prev => {
      const newSet = new Set(prev);
      if (newSet.has(path)) {
        newSet.delete(path);
      } else {
        newSet.add(path);
      }
      return newSet;
    });
  };

  const selectAll = () => {
    setSelectedPaths(new Set(entries.map(e => e.path)));
  };

  const deselectAll = () => {
    setSelectedPaths(new Set());
  };

  const handleAddSelected = () => {
    if (selectedPaths.size > 0) {
      onSelect(Array.from(selectedPaths));
      setSelectedPaths(new Set()); // Clear selection after adding
    }
  };

  return (
    <div className="directory-browser" style={{ background: '#0f172a', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #334155' }}>
      {/* Path Navigation */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'center' }}>
        <button onClick={handleUp} disabled={currentPath === '/'} style={{ padding: '0.25rem 0.5rem' }}>⬆️</button>
        <div style={{ fontFamily: 'monospace', fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
          {currentPath}
        </div>
      </div>

      {/* Selection Controls */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <button onClick={selectAll} disabled={entries.length === 0} style={{ fontSize: '0.8rem', padding: '0.3rem 0.6rem', background: '#1e293b', border: '1px solid #334155', borderRadius: '4px', color: '#94a3b8', cursor: 'pointer' }}>
          Select All
        </button>
        <button onClick={deselectAll} disabled={selectedPaths.size === 0} style={{ fontSize: '0.8rem', padding: '0.3rem 0.6rem', background: '#1e293b', border: '1px solid #334155', borderRadius: '4px', color: '#94a3b8', cursor: 'pointer' }}>
          Deselect All
        </button>
        <div style={{ fontSize: '0.85rem', color: '#64748b', marginLeft: 'auto' }}>
          {selectedPaths.size > 0 ? `${selectedPaths.size} selected` : 'No selection'}
        </div>
        <button
          onClick={handleAddSelected}
          disabled={selectedPaths.size === 0}
          style={{
            fontSize: '0.85rem',
            padding: '0.4rem 0.8rem',
            background: selectedPaths.size > 0 ? '#3b82f6' : '#334155',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontWeight: 'bold',
            cursor: selectedPaths.size > 0 ? 'pointer' : 'not-allowed',
            opacity: selectedPaths.size > 0 ? 1 : 0.5
          }}
        >
          Add Selected ({selectedPaths.size})
        </button>
      </div>

      <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
        {loading ? (
          <div style={{ padding: '1rem', color: '#94a3b8' }}>Loading...</div>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {entries.map((entry) => (
              <li key={entry.path} style={{ display: 'flex', alignItems: 'center', padding: '0.4rem', borderBottom: '1px solid #1e293b' }}>
                <input
                  type="checkbox"
                  checked={selectedPaths.has(entry.path)}
                  onChange={() => toggleSelection(entry.path)}
                  style={{ marginRight: '0.5rem', cursor: 'pointer', width: '16px', height: '16px' }}
                />
                <span style={{ marginRight: '0.5rem' }}>{entry.is_directory ? '📁' : '📄'}</span>
                <span
                  style={{ flex: 1, cursor: entry.is_directory ? 'pointer' : 'default', color: entry.is_directory ? '#60a5fa' : '#94a3b8' }}
                  onClick={() => entry.is_directory && handleNavigate(entry.path)}
                >
                  {entry.name}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}