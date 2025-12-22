import { useState, useEffect } from 'react';

export function FileViewer({ bucketName, filePath, fileName, onClose }) {
  const [fileUrl, setFileUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [fileType, setFileType] = useState('unknown');

  useEffect(() => {
    loadFile();

    // Cleanup function to revoke object URL
    return () => {
      if (fileUrl) {
        URL.revokeObjectURL(fileUrl);
      }
    };
  }, [bucketName, filePath]);

  const loadFile = async () => {
    try {
      setLoading(true);
      setError(null);

      const { bucketAPI } = await import('../services/api');
      const response = await bucketAPI.getFile(bucketName, filePath);

      // Create a blob URL for the file
      const blob = response.data;
      const url = URL.createObjectURL(blob);
      setFileUrl(url);

      // Determine file type from extension
      const ext = fileName.toLowerCase().split('.').pop();
      if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp'].includes(ext)) {
        setFileType('image');
      } else if (ext === 'pdf') {
        setFileType('pdf');
      } else if (['txt', 'md', 'json', 'xml', 'csv', 'log', 'py', 'js', 'jsx', 'ts', 'tsx', 'html', 'css', 'java', 'c', 'cpp', 'h', 'go', 'rs', 'sh'].includes(ext)) {
        setFileType('text');
        // For text files, read the blob as text
        const text = await blob.text();
        setFileUrl(text);
      } else {
        setFileType('download');
      }

      setLoading(false);
    } catch (err) {
      console.error('Failed to load file:', err);
      setError('Failed to load file: ' + (err.response?.data?.detail || err.message));
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!fileUrl) return;

    const a = document.createElement('a');
    if (fileType === 'text') {
      const blob = new Blob([fileUrl], { type: 'text/plain' });
      a.href = URL.createObjectURL(blob);
    } else {
      a.href = fileUrl;
    }
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '2rem'
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--bg-primary)',
          borderRadius: '0.5rem',
          border: '1px solid var(--border)',
          maxWidth: '90vw',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '1rem 1.5rem',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'var(--bg-secondary)'
          }}
        >
          <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-primary)' }}>
            {fileName}
          </h3>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={handleDownload}
              disabled={loading || error}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '0.25rem',
                border: '1px solid var(--border)',
                background: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                cursor: loading || error ? 'not-allowed' : 'pointer',
                opacity: loading || error ? 0.5 : 1
              }}
            >
              Download
            </button>
            <button
              onClick={onClose}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '0.25rem',
                border: 'none',
                background: '#ef4444',
                color: 'white',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              Close
            </button>
          </div>
        </div>

        {/* Content */}
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            padding: '1.5rem',
            minWidth: '400px',
            minHeight: '300px'
          }}
        >
          {loading && (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
              Loading file...
            </div>
          )}

          {error && (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#ef4444' }}>
              {error}
            </div>
          )}

          {!loading && !error && fileType === 'image' && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <img
                src={fileUrl}
                alt={fileName}
                style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain' }}
              />
            </div>
          )}

          {!loading && !error && fileType === 'pdf' && (
            <iframe
              src={fileUrl}
              style={{ width: '100%', height: '70vh', border: 'none' }}
              title={fileName}
            />
          )}

          {!loading && !error && fileType === 'text' && (
            <pre
              style={{
                background: 'var(--bg-secondary)',
                padding: '1rem',
                borderRadius: '0.25rem',
                overflow: 'auto',
                maxHeight: '70vh',
                fontSize: '0.9rem',
                lineHeight: '1.5',
                color: 'var(--text-primary)',
                whiteSpace: 'pre-wrap',
                wordWrap: 'break-word'
              }}
            >
              {fileUrl}
            </pre>
          )}

          {!loading && !error && fileType === 'download' && (
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                This file type cannot be previewed. Click the Download button to download it.
              </p>
              <button
                onClick={handleDownload}
                style={{
                  padding: '0.75rem 1.5rem',
                  borderRadius: '0.5rem',
                  border: 'none',
                  background: 'var(--accent)',
                  color: 'white',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontSize: '1rem'
                }}
              >
                Download {fileName}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
