import { useState, useEffect } from 'react';
import { browseAPI } from '../services/api';

export function DirectoryBrowser({ onSelect }) {
  const [currentPath, setCurrentPath] = useState('/workspace');
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);

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

  return (
    <div className="directory-browser" style={{ background: '#0f172a', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #334155' }}>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', alignItems: 'center' }}>
        <button onClick={handleUp} disabled={currentPath === '/'} style={{ padding: '0.25rem 0.5rem' }}>⬆️</button>
        <div style={{ fontFamily: 'monospace', fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {currentPath}
        </div>
      </div>

      <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
        {loading ? (
          <div style={{ padding: '1rem', color: '#94a3b8' }}>Loading...</div>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {entries.map((entry) => (
              <li key={entry.path} style={{ display: 'flex', alignItems: 'center', padding: '0.4rem', borderBottom: '1px solid #1e293b' }}>
                <span style={{ marginRight: '0.5rem' }}>{entry.is_directory ? 'Qw' : '📄'}</span>
                <span 
                  style={{ flex: 1, cursor: entry.is_directory ? 'pointer' : 'default', color: entry.is_directory ? '#60a5fa' : '#94a3b8' }}
                  onClick={() => entry.is_directory && handleNavigate(entry.path)}
                >
                  {entry.name}
                </span>
                {entry.is_directory && (
                  <button 
                    onClick={() => onSelect(entry.path)}
                    style={{ fontSize: '0.8rem', padding: '0.2rem 0.5rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px' }}
                  >
                    Add
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}