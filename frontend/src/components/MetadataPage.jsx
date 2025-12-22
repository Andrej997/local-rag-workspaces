import { useState, useEffect } from 'react';
import { metadataAPI } from '../services/api';
import { useIndexing } from '../context/IndexingContext';

export function MetadataPage() {
  const { state } = useIndexing();
  const { currentBucket } = state;

  const [collections, setCollections] = useState([]);
  const [selectedCollection, setSelectedCollection] = useState(null);
  const [collectionDetails, setCollectionDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);

  useEffect(() => {
    loadCollections();
  }, [currentBucket?.name]);

  const loadCollections = async () => {
    setLoading(true);
    setSelectedCollection(null);
    setCollectionDetails(null);

    try {
      if (!currentBucket) {
        setCollections([]);
        setLoading(false);
        return;
      }

      const res = await metadataAPI.getCollections();
      const allCollections = res.data.collections || [];

      // Normalize bucket name to match Milvus collection naming (replace special chars with _)
      const normalizedBucketName = currentBucket.name.replace(/[^a-zA-Z0-9_]/g, '_');

      // Filter to show only the collection for the current space
      const filteredCollections = allCollections.filter(
        col => col.name === normalizedBucketName
      );

      setCollections(filteredCollections);

      // Auto-load the collection details if found
      if (filteredCollections.length > 0) {
        loadCollectionDetails(filteredCollections[0].name);
      }
    } catch (err) {
      console.error("Failed to load collections", err);
      alert("Failed to load collections: " + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  const loadCollectionDetails = async (collectionName) => {
    setDetailsLoading(true);
    setSelectedCollection(collectionName);
    try {
      const res = await metadataAPI.getCollectionMetadata(collectionName);
      setCollectionDetails(res.data);
    } catch (err) {
      console.error("Failed to load collection details", err);
      alert("Failed to load collection details: " + (err.response?.data?.detail || err.message));
      setCollectionDetails(null);
    } finally {
      setDetailsLoading(false);
    }
  };

  if (loading) {
    return <div style={{ padding: '2rem' }}>Loading metadata...</div>;
  }

  if (!currentBucket) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🗂️</div>
        <h2>No Space Selected</h2>
        <p>Please select a space from the sidebar to view its metadata.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '1.5rem', height: '100%', overflowY: 'auto' }}>
      <h1 style={{ marginBottom: '0.5rem', fontSize: '1.8rem' }}>
        Metadata: <span style={{ color: 'var(--accent)' }}>{currentBucket.name}</span>
      </h1>
      <p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>
        Vector database collection metadata for this space
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.5rem' }}>
        {/* Collections List */}
        <div className="card" style={{ padding: '1.5rem', maxHeight: '600px', overflowY: 'auto' }}>
          <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>Collection Info</h3>
          {collections.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📭</div>
              <p style={{ color: '#6b7280', fontStyle: 'italic' }}>
                No collection found for this space.<br/>
                Please index some files first.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {collections.map((collection) => (
                <div
                  key={collection.name}
                  onClick={() => !collection.error && loadCollectionDetails(collection.name)}
                  style={{
                    padding: '1rem',
                    borderRadius: '0.5rem',
                    border: '1px solid var(--border)',
                    background: selectedCollection === collection.name ? 'rgba(59, 130, 246, 0.1)' : 'var(--bg-primary)',
                    cursor: collection.error ? 'default' : 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    if (!collection.error && selectedCollection !== collection.name) {
                      e.currentTarget.style.background = 'rgba(59, 130, 246, 0.05)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (selectedCollection !== collection.name) {
                      e.currentTarget.style.background = 'var(--bg-primary)';
                    }
                  }}
                >
                  <div style={{ fontWeight: '600', marginBottom: '0.25rem' }}>{collection.name}</div>
                  {collection.error ? (
                    <div style={{ fontSize: '0.75rem', color: '#ef4444' }}>Error: {collection.error}</div>
                  ) : (
                    <>
                      <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                        {collection.num_entities?.toLocaleString() || 0} entities
                      </div>
                      {collection.description && (
                        <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.25rem' }}>
                          {collection.description}
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Collection Details */}
        <div className="card" style={{ padding: '1.5rem', maxHeight: '600px', overflowY: 'auto' }}>
          {!selectedCollection ? (
            <div style={{ color: '#6b7280', textAlign: 'center', padding: '2rem' }}>
              Select a collection to view details
            </div>
          ) : detailsLoading ? (
            <div style={{ color: '#6b7280', textAlign: 'center', padding: '2rem' }}>
              Loading collection details...
            </div>
          ) : collectionDetails ? (
            <div>
              <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>{collectionDetails.name}</h3>

              {/* Stats */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                <div style={{ padding: '1rem', background: 'rgba(59, 130, 246, 0.05)', borderRadius: '0.5rem', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>Total Entities</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#3b82f6' }}>
                    {collectionDetails.num_entities?.toLocaleString() || 0}
                  </div>
                </div>
                <div style={{ padding: '1rem', background: 'rgba(16, 185, 129, 0.05)', borderRadius: '0.5rem', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>Fields</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#10b981' }}>
                    {collectionDetails.fields?.length || 0}
                  </div>
                </div>
              </div>

              {/* Schema Fields */}
              <div style={{ marginBottom: '1.5rem' }}>
                <h4 style={{ marginBottom: '0.75rem', fontSize: '1rem' }}>Schema Fields</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {collectionDetails.fields?.map((field, idx) => (
                    <div key={idx} style={{ padding: '0.75rem', background: 'var(--bg-primary)', borderRadius: '0.5rem', border: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                        <span style={{ fontWeight: '600' }}>{field.name}</span>
                        <span style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', borderRadius: '0.25rem', background: 'rgba(148, 163, 184, 0.1)', color: '#94a3b8' }}>
                          {field.type}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#6b7280', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                        {field.is_primary && <span style={{ color: '#3b82f6' }}>Primary Key</span>}
                        {field.auto_id && <span>Auto ID</span>}
                        {field.dimension && <span>Dimension: {field.dimension}</span>}
                        {field.max_length && <span>Max Length: {field.max_length}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Indexes */}
              {collectionDetails.indexes && collectionDetails.indexes.length > 0 && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <h4 style={{ marginBottom: '0.75rem', fontSize: '1rem' }}>Indexes</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {collectionDetails.indexes.map((index, idx) => (
                      <div key={idx} style={{ padding: '0.75rem', background: 'rgba(16, 185, 129, 0.05)', borderRadius: '0.5rem', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                        <div style={{ fontWeight: '600', marginBottom: '0.25rem' }}>Field: {index.field}</div>
                        <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                          Type: {index.type} | Metric: {index.metric}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Sample Data */}
              {collectionDetails.sample_data && collectionDetails.sample_data.length > 0 && (
                <div>
                  <h4 style={{ marginBottom: '0.75rem', fontSize: '1rem' }}>Sample Data (First 10 records)</h4>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid var(--border)' }}>
                          <th style={{ padding: '0.5rem', textAlign: 'left' }}>ID</th>
                          <th style={{ padding: '0.5rem', textAlign: 'left' }}>Filename</th>
                          <th style={{ padding: '0.5rem', textAlign: 'left' }}>Content Preview</th>
                        </tr>
                      </thead>
                      <tbody>
                        {collectionDetails.sample_data.map((row, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td style={{ padding: '0.5rem' }}>{row.id}</td>
                            <td style={{ padding: '0.5rem', fontFamily: 'monospace', fontSize: '0.8rem' }}>{row.filename}</td>
                            <td style={{ padding: '0.5rem', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {row.content?.substring(0, 100) || ''}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div style={{ color: '#ef4444', textAlign: 'center', padding: '2rem' }}>
              Failed to load collection details
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
