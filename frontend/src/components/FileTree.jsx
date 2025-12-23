/**
 * FileTree Component
 * Displays a hierarchical tree view of files and folders with delete and view actions
 */
export function FileTree({ files, bucketName, onDelete, onView }) {
  const structure = {};

  // Build tree structure from file metadata
  files.forEach(file => {
    let displayPath = file.path;

    // Normalize slashes
    const normalized = file.path.replace(/\\/g, '/');

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
        current[part] = {
          _children: {},
          _path: null,
          _metadata: null
        };
      }
      if (index === parts.length - 1) {
        current[part]._path = file.path; // STORE ORIGINAL FULL PATH for deletion
        current[part]._metadata = file; // Store full metadata
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

    const handleView = () => {
      if (isFile && onView) {
        onView(node._path, name);
      }
    };

    // Format timestamp for display
    const formatDate = (dateString) => {
      const date = new Date(dateString);
      const now = new Date();
      const diffInSeconds = (now - date) / 1000;

      if (diffInSeconds < 60) return 'just now';
      if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
      if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
      if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;

      // Format as date
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
    };

    // Format file size
    const formatSize = (bytes) => {
      if (bytes < 1024) return bytes + ' B';
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
      return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    return (
      <li key={name} style={{ marginLeft: '1.5rem', listStyle: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '2px 0' }}>
          <span style={{ color: hasChildren ? '#fbbf24' : '#94a3b8' }}>{hasChildren ? '📁' : '📄'}</span>
          <span
            style={{
              color: '#e2e8f0',
              fontSize: '0.9rem',
              cursor: isFile ? 'pointer' : 'default',
              textDecoration: isFile ? 'underline' : 'none',
              textDecorationColor: isFile ? '#3b82f6' : 'transparent',
              flex: 1
            }}
            onClick={handleView}
            title={isFile ? "Click to view file" : ""}
          >
            {name}
          </span>
          {isFile && node._metadata && (
            <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.75rem', color: '#64748b' }}>
              <span title={`Size: ${formatSize(node._metadata.size)}`}>{formatSize(node._metadata.size)}</span>
              <span title={new Date(node._metadata.last_modified).toLocaleString()}>{formatDate(node._metadata.last_modified)}</span>
            </div>
          )}
          <button
            onClick={handleDelete}
            style={{
              color: '#ef4444', background: 'none', border: 'none',
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
