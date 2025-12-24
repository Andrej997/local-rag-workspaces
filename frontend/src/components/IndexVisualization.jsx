import { useState, useEffect, useMemo } from 'react';
import { useIndexing } from '../context/IndexingContext';
import { visualizationAPI } from '../services/api';
import ForceGraph2D from 'react-force-graph-2d';

// --- CRITICAL FIX: Factory Pattern for Plotly ---
// This prevents Vite bundling issues that cause blank graphs
import Plotly from 'plotly.js/dist/plotly';
import createPlotlyComponent from 'react-plotly.js/factory';
const Plot = createPlotlyComponent(Plotly);

export function IndexVisualization() {
  const { state } = useIndexing();
  const { currentBucket } = state;

  // View states
  const [points, setPoints] = useState([]);
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState('2D'); // '2D' | '3D'
  const [visualizationType, setVisualizationType] = useState('scatter'); // 'scatter' | 'graph'
  const [dataDimensions, setDataDimensions] = useState(2);

  // Feature states
  const [useClustering, setUseClustering] = useState(false);
  const [nClusters, setNClusters] = useState(8);
  const [queryText, setQueryText] = useState('');
  const [colorBy, setColorBy] = useState('extension'); // 'extension' | 'cluster'
  const [graphThreshold, setGraphThreshold] = useState(0.8);
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    if (currentBucket) {
      if (visualizationType === 'scatter') {
        fetchScatterData(viewMode === '3D' ? 3 : 2);
      } else {
        fetchGraphData();
      }
    }
  }, [currentBucket, viewMode, visualizationType, useClustering, nClusters]);

  const fetchScatterData = async (dim) => {
    setLoading(true);
    setError(null);
    try {
      const res = await visualizationAPI.getData(
        currentBucket.name,
        dim,
        useClustering,
        nClusters
      );

      if (res.data.error) throw new Error(res.data.error);
      if (res.data.message) throw new Error(res.data.message);

      const loadedPoints = res.data.points || [];
      setPoints(loadedPoints);

      const actualDim = res.data.dimensions || (loadedPoints[0]?.z !== undefined ? 3 : 2);
      setDataDimensions(actualDim);

      if (dim === 3 && actualDim === 2 && loadedPoints.length > 0) {
        console.warn("Requested 3D but got 2D. Backend might need rebuilding.");
      }

    } catch (err) {
      console.error("Viz Error:", err);
      setError(err.message || "Failed to load visualization data");
    } finally {
      setLoading(false);
    }
  };

  const fetchGraphData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await visualizationAPI.getSimilarityGraph(
        currentBucket.name,
        graphThreshold
      );

      if (res.data.error) throw new Error(res.data.error);
      if (res.data.message) throw new Error(res.data.message);

      const nodes = res.data.nodes || [];
      const edges = res.data.edges || [];

      // Format for react-force-graph
      setGraphData({
        nodes: nodes.map(n => ({
          id: n.id,
          name: n.filename,
          content: n.content,
          extension: n.extension
        })),
        links: edges.map(e => ({
          source: e.source,
          target: e.target,
          value: e.similarity
        }))
      });

    } catch (err) {
      console.error("Graph Error:", err);
      setError(err.message || "Failed to load similarity graph");
    } finally {
      setLoading(false);
    }
  };

  const projectQuery = async () => {
    if (!queryText.trim()) return;

    setLoading(true);
    setError(null);
    try {
      const dim = viewMode === '3D' ? 3 : 2;
      const res = await visualizationAPI.projectQuery(
        currentBucket.name,
        queryText,
        dim
      );

      if (res.data.error) throw new Error(res.data.error);

      const loadedPoints = res.data.points || [];
      setPoints(loadedPoints);
      setDataDimensions(res.data.dimensions || dim);

    } catch (err) {
      console.error("Query Projection Error:", err);
      setError(err.message || "Failed to project query");
    } finally {
      setLoading(false);
    }
  };

  // Color palette for clusters
  const clusterColors = [
    '#6366f1', '#8b5cf6', '#ec4899', '#f59e0b',
    '#10b981', '#3b82f6', '#ef4444', '#14b8a6',
    '#f97316', '#84cc16', '#a855f7', '#06b6d4'
  ];

  // Prepare data for Plotly scatter plot
  const plotData = useMemo(() => {
    const traces = {};

    points.forEach(p => {
      let groupKey;
      let groupName;

      if (colorBy === 'cluster' && p.cluster !== undefined) {
        groupKey = `cluster_${p.cluster}`;
        groupName = `Topic ${p.cluster}`;
      } else if (p.type === 'query') {
        groupKey = 'query';
        groupName = 'Query';
      } else {
        const ext = p.filename && p.filename.includes('.') ? p.filename.split('.').pop() : 'other';
        groupKey = ext;
        groupName = ext;
      }

      if (!traces[groupKey]) {
        const isQuery = p.type === 'query';
        const color = colorBy === 'cluster' && p.cluster !== undefined
          ? clusterColors[p.cluster % clusterColors.length]
          : isQuery ? '#ef4444' : undefined;

        traces[groupKey] = {
          x: [], y: [], z: [],
          text: [],
          type: viewMode === '3D' ? 'scatter3d' : 'scatter',
          mode: 'markers',
          name: groupName,
          marker: {
            size: isQuery ? 20 : (viewMode === '3D' ? 4 : 8),
            color: color,
            symbol: isQuery ? 'star' : 'circle',
            line: isQuery ? { color: 'white', width: 2 } : undefined
          }
        };
      }

      traces[groupKey].x.push(p.x);
      traces[groupKey].y.push(p.y);

      if (viewMode === '3D') {
        traces[groupKey].z.push(p.z || 0);
      }

      const safeContent = p.content ? p.content.substring(0, 60).replace(/</g, "&lt;") : "";
      traces[groupKey].text.push(`<b>${p.filename}</b><br>${safeContent}...`);
    });

    return Object.values(traces);
  }, [points, viewMode, colorBy]);

  if (!currentBucket) {
    return <div className="card" style={{padding: '2rem'}}>No space selected.</div>;
  }

  return (
    <div className="visualization-page" style={{ padding: '1.5rem', height: '100%', display: 'flex', flexDirection: 'column' }}>

      {/* Guide Modal */}
      {showGuide && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.8)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem'
        }} onClick={() => setShowGuide(false)}>
          <div style={{
            background: '#1e293b',
            border: '1px solid #334155',
            borderRadius: '1rem',
            maxWidth: '800px',
            maxHeight: '80vh',
            overflow: 'auto',
            padding: '2rem',
            position: 'relative'
          }} onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setShowGuide(false)}
              style={{
                position: 'absolute',
                top: '1rem',
                right: '1rem',
                background: '#334155',
                border: 'none',
                color: '#f8fafc',
                fontSize: '1.5rem',
                cursor: 'pointer',
                borderRadius: '0.5rem',
                width: '40px',
                height: '40px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              ×
            </button>

            <h2 style={{ fontSize: '1.8rem', fontWeight: 'bold', marginBottom: '1.5rem', color: '#f8fafc' }}>
              📚 Visualization Guide
            </h2>

            <div style={{ color: '#cbd5e1', lineHeight: '1.8' }}>
              <section style={{ marginBottom: '2rem' }}>
                <h3 style={{ fontSize: '1.3rem', fontWeight: 600, color: '#6366f1', marginBottom: '0.75rem' }}>
                  🎯 Scatter Plot Visualization
                </h3>
                <p style={{ marginBottom: '0.75rem' }}>
                  Shows your documents as points in 2D or 3D space using PCA dimensionality reduction.
                  Documents with similar content appear closer together.
                </p>
                <ul style={{ marginLeft: '1.5rem', marginBottom: '0.75rem' }}>
                  <li><strong>2D/3D Toggle:</strong> Switch between 2-dimensional and 3-dimensional views</li>
                  <li><strong>Color by File Type:</strong> Points colored by file extension (.py, .js, .md, etc.)</li>
                  <li><strong>Color by Semantic Topic:</strong> Points colored by content similarity (discovers themes)</li>
                </ul>
              </section>

              <section style={{ marginBottom: '2rem' }}>
                <h3 style={{ fontSize: '1.3rem', fontWeight: 600, color: '#8b5cf6', marginBottom: '0.75rem' }}>
                  🔍 Query Debugger
                </h3>
                <p style={{ marginBottom: '0.75rem' }}>
                  Projects your search query into the same space as documents. Helps debug why certain documents
                  are retrieved (or missed).
                </p>
                <ul style={{ marginLeft: '1.5rem', marginBottom: '0.75rem' }}>
                  <li><strong>Red Star:</strong> Shows where your query lands in the document space</li>
                  <li><strong>Distance Matters:</strong> If the query star is far from relevant docs, your embeddings may need tuning</li>
                  <li><strong>Use Case:</strong> "Why isn't MinIO documentation showing up for 'configure storage'?"</li>
                </ul>
              </section>

              <section style={{ marginBottom: '2rem' }}>
                <h3 style={{ fontSize: '1.3rem', fontWeight: 600, color: '#f59e0b', marginBottom: '0.75rem' }}>
                  🎨 Semantic Clustering
                </h3>
                <p style={{ marginBottom: '0.75rem' }}>
                  Uses K-Means to automatically discover topics in your documents based on content,
                  not file type.
                </p>
                <ul style={{ marginLeft: '1.5rem', marginBottom: '0.75rem' }}>
                  <li><strong>Topic Discovery:</strong> Reveals themes like "Database Logic", "UI Components", "Configuration"</li>
                  <li><strong>Adjustable Clusters:</strong> Set 2-20 topics based on your workspace size</li>
                  <li><strong>Better than File Type:</strong> Groups by what code does, not what it's named</li>
                </ul>
              </section>

              <section style={{ marginBottom: '2rem' }}>
                <h3 style={{ fontSize: '1.3rem', fontWeight: 600, color: '#10b981', marginBottom: '0.75rem' }}>
                  🕸️ Force-Directed Graph
                </h3>
                <p style={{ marginBottom: '0.75rem' }}>
                  Network visualization showing document relationships. Nodes are files, edges connect similar documents.
                </p>
                <ul style={{ marginLeft: '1.5rem', marginBottom: '0.75rem' }}>
                  <li><strong>Similarity Threshold:</strong> Adjust to show more/fewer connections (50-95%)</li>
                  <li><strong>Edge Thickness:</strong> Thicker lines = more similar documents</li>
                  <li><strong>Use Case:</strong> "If I change this file, what else might break?"</li>
                </ul>
              </section>

              <section style={{ marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1.3rem', fontWeight: 600, color: '#ec4899', marginBottom: '0.75rem' }}>
                  🚀 Workflow
                </h3>
                <ol style={{ marginLeft: '1.5rem' }}>
                  <li style={{ marginBottom: '0.5rem' }}><strong>Start with Scatter Plot:</strong> Get an overview of your document space</li>
                  <li style={{ marginBottom: '0.5rem' }}><strong>Enable Semantic Clustering:</strong> Discover content-based topics</li>
                  <li style={{ marginBottom: '0.5rem' }}><strong>Test Queries:</strong> Use Query Debugger to understand retrieval behavior</li>
                  <li style={{ marginBottom: '0.5rem' }}><strong>Explore Relationships:</strong> Switch to Force Graph to see document connections</li>
                  <li style={{ marginBottom: '0.5rem' }}><strong>Optimize:</strong> If queries land far from relevant docs, adjust chunking or embeddings</li>
                </ol>
              </section>
            </div>
          </div>
        </div>
      )}

      {/* Header with controls */}
      <div className="page-header" style={{ marginBottom: '1rem' }}>
        <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ fontSize: '1.8rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
              Index Visualization
            </h1>
            <div style={{ color: '#cbd5e1', fontSize: '0.9rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              {visualizationType === 'scatter' && <span>{points.length} vectors</span>}
              {visualizationType === 'graph' && (
                <span>{graphData.nodes.length} nodes, {graphData.links.length} edges</span>
              )}
              {viewMode === '3D' && dataDimensions === 2 && (
                <span style={{ color: '#f59e0b' }}>⚠️ Backend returned 2D data</span>
              )}
            </div>
          </div>
          <button
            onClick={() => setShowGuide(true)}
            style={{
              padding: '0.5rem 1rem',
              background: 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.95rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            📚 Guide
          </button>
        </div>

        {/* Control Panel */}
        <div style={{
          background: '#1e293b',
          padding: '1rem',
          borderRadius: '0.75rem',
          border: '1px solid #334155',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem'
        }}>

          {/* Row 1: Visualization Type */}
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ minWidth: '120px' }}>
              <label style={{ color: '#cbd5e1', fontWeight: 600, display: 'block' }}>
                Visualization:
              </label>
              <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Choose view type</span>
            </div>
            <div style={{ background: '#0f172a', padding: '4px', borderRadius: '8px', border: '1px solid #334155', display: 'flex' }}>
              <button
                onClick={() => setVisualizationType('scatter')}
                style={{
                  padding: '6px 16px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                  background: visualizationType === 'scatter' ? 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' : 'transparent',
                  color: visualizationType === 'scatter' ? 'white' : '#cbd5e1', fontWeight: 'bold',
                  transition: 'all 0.2s'
                }}
              >
                Scatter Plot
              </button>
              <button
                onClick={() => setVisualizationType('graph')}
                style={{
                  padding: '6px 16px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                  background: visualizationType === 'graph' ? 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' : 'transparent',
                  color: visualizationType === 'graph' ? 'white' : '#cbd5e1', fontWeight: 'bold',
                  transition: 'all 0.2s'
                }}
              >
                Force Graph
              </button>
            </div>

            {visualizationType === 'scatter' && (
              <div style={{ background: '#0f172a', padding: '4px', borderRadius: '8px', border: '1px solid #334155', display: 'flex' }}>
                <button
                  onClick={() => setViewMode('2D')}
                  style={{
                    padding: '6px 16px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                    background: viewMode === '2D' ? 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)' : 'transparent',
                    color: viewMode === '2D' ? 'white' : '#cbd5e1', fontWeight: 'bold'
                  }}
                >
                  2D
                </button>
                <button
                  onClick={() => setViewMode('3D')}
                  style={{
                    padding: '6px 16px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                    background: viewMode === '3D' ? 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)' : 'transparent',
                    color: viewMode === '3D' ? 'white' : '#cbd5e1', fontWeight: 'bold'
                  }}
                >
                  3D
                </button>
              </div>
            )}
          </div>

          {/* Row 2: Clustering controls (scatter only) */}
          {visualizationType === 'scatter' && (
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ minWidth: '120px' }}>
                <label style={{ color: '#cbd5e1', fontWeight: 600, display: 'block' }}>
                  Color by:
                </label>
                <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Group documents</span>
              </div>
              <div style={{ background: '#0f172a', padding: '4px', borderRadius: '8px', border: '1px solid #334155', display: 'flex' }}>
                <button
                  onClick={() => { setColorBy('extension'); setUseClustering(false); }}
                  style={{
                    padding: '6px 16px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                    background: colorBy === 'extension' ? 'linear-gradient(135deg, #f59e0b 0%, #fb923c 100%)' : 'transparent',
                    color: colorBy === 'extension' ? 'white' : '#cbd5e1', fontWeight: 'bold'
                  }}
                >
                  File Type
                </button>
                <button
                  onClick={() => { setColorBy('cluster'); setUseClustering(true); }}
                  style={{
                    padding: '6px 16px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                    background: colorBy === 'cluster' ? 'linear-gradient(135deg, #f59e0b 0%, #fb923c 100%)' : 'transparent',
                    color: colorBy === 'cluster' ? 'white' : '#cbd5e1', fontWeight: 'bold'
                  }}
                >
                  Semantic Topic
                </button>
              </div>

              {colorBy === 'cluster' && (
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <label style={{ color: '#cbd5e1', fontSize: '0.9rem' }}>
                    Topics:
                  </label>
                  <input
                    type="number"
                    min="2"
                    max="20"
                    value={nClusters}
                    onChange={(e) => setNClusters(parseInt(e.target.value) || 8)}
                    style={{
                      width: '60px',
                      padding: '4px 8px',
                      background: '#0f172a',
                      border: '1px solid #334155',
                      borderRadius: '4px',
                      color: '#f8fafc'
                    }}
                  />
                </div>
              )}
            </div>
          )}

          {/* Row 3: Query projection (scatter only) */}
          {visualizationType === 'scatter' && (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ minWidth: '120px' }}>
                <label style={{ color: '#cbd5e1', fontWeight: 600, display: 'block' }}>
                  Query Debugger:
                </label>
                <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Test search queries</span>
              </div>
              <input
                type="text"
                placeholder="Enter a search query to see where it lands..."
                value={queryText}
                onChange={(e) => setQueryText(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && projectQuery()}
                style={{
                  flex: 1,
                  minWidth: '300px',
                  padding: '8px 12px',
                  background: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '6px',
                  color: '#f8fafc',
                  fontSize: '0.95rem'
                }}
              />
              <button
                onClick={projectQuery}
                disabled={!queryText.trim() || loading}
                style={{
                  padding: '8px 16px',
                  background: queryText.trim() ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' : '#334155',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: queryText.trim() && !loading ? 'pointer' : 'not-allowed',
                  fontWeight: 600,
                  opacity: queryText.trim() && !loading ? 1 : 0.5
                }}
              >
                🔍 Project Query
              </button>
              <button
                onClick={() => { setQueryText(''); fetchScatterData(viewMode === '3D' ? 3 : 2); }}
                style={{
                  padding: '8px 16px',
                  background: '#334155',
                  color: '#f8fafc',
                  border: '1px solid #334155',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                Clear
              </button>
            </div>
          )}

          {/* Row 4: Graph threshold (graph only) */}
          {visualizationType === 'graph' && (
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ minWidth: '120px' }}>
                <label style={{ color: '#cbd5e1', fontWeight: 600, display: 'block' }}>
                  Similarity:
                </label>
                <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Edge threshold</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="0.95"
                step="0.05"
                value={graphThreshold}
                onChange={(e) => setGraphThreshold(parseFloat(e.target.value))}
                style={{ flex: 1, maxWidth: '300px' }}
              />
              <span style={{ color: '#f8fafc', fontWeight: 600, minWidth: '60px' }}>
                {(graphThreshold * 100).toFixed(0)}%
              </span>
              <button
                onClick={fetchGraphData}
                disabled={loading}
                style={{
                  padding: '8px 16px',
                  background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                Update
              </button>
            </div>
          )}

          {/* Refresh button */}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={() => visualizationType === 'scatter' ? fetchScatterData(viewMode === '3D' ? 3 : 2) : fetchGraphData()}
              disabled={loading}
              style={{
                background: '#334155',
                color: '#f8fafc',
                border: '1px solid #334155',
                padding: '0.6rem 1rem',
                borderRadius: '0.5rem',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.5 : 1
              }}
            >
              {loading ? 'Refreshing...' : '🔄 Refresh'}
            </button>
          </div>
        </div>
      </div>

      {/* Info Banner */}
      {visualizationType === 'scatter' && !queryText && (
        <div style={{
          background: 'rgba(99, 102, 241, 0.1)',
          border: '1px solid #6366f1',
          borderRadius: '0.75rem',
          padding: '1rem',
          marginBottom: '1rem',
          color: '#cbd5e1',
          fontSize: '0.9rem'
        }}>
          <strong style={{ color: '#6366f1' }}>💡 Tip:</strong> {colorBy === 'cluster'
            ? 'Semantic clustering reveals content-based topics in your documents. Similar content clusters together regardless of file type.'
            : 'Documents are grouped by file extension. Switch to "Semantic Topic" to discover content-based themes.'}
        </div>
      )}
      {visualizationType === 'scatter' && queryText && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid #ef4444',
          borderRadius: '0.75rem',
          padding: '1rem',
          marginBottom: '1rem',
          color: '#cbd5e1',
          fontSize: '0.9rem'
        }}>
          <strong style={{ color: '#ef4444' }}>🔍 Query Active:</strong> The red star shows where your query "{queryText}" lands in document space. If it's far from relevant docs, your embeddings may need adjustment.
        </div>
      )}
      {visualizationType === 'graph' && (
        <div style={{
          background: 'rgba(16, 185, 129, 0.1)',
          border: '1px solid #10b981',
          borderRadius: '0.75rem',
          padding: '1rem',
          marginBottom: '1rem',
          color: '#cbd5e1',
          fontSize: '0.9rem'
        }}>
          <strong style={{ color: '#10b981' }}>🕸️ Force Graph:</strong> Nodes are documents, edges connect similar content. Thicker lines = stronger similarity. Use this to find related files that should be updated together.
        </div>
      )}

      {/* Visualization Area */}
      <div className="card" style={{
        flex: 1,
        padding: '1rem',
        position: 'relative',
        height: '600px',
        width: '100%',
        minHeight: '500px',
        background: '#1e293b',
        border: '1px solid #334155'
      }}>
        {loading && (
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.7)',
            zIndex: 10,
            borderRadius: '0.75rem'
          }}>
            <span style={{ color: 'white', fontWeight: 'bold', fontSize: '1.2rem' }}>
              {visualizationType === 'scatter' ? 'Processing Vectors...' : 'Building Graph...'}
            </span>
          </div>
        )}

        {error ? (
          <div style={{ padding: '2rem', color: '#ef4444', textAlign: 'center' }}>{error}</div>
        ) : visualizationType === 'scatter' ? (
          points.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#cbd5e1' }}>
              No vectors found. Index some files first!
            </div>
          ) : (
            <Plot
              data={plotData}
              layout={{
                autosize: true,
                margin: { l: 0, r: 0, b: 0, t: 0 },
                paper_bgcolor: 'rgba(0,0,0,0)',
                plot_bgcolor: 'rgba(0,0,0,0)',
                font: { color: '#cbd5e1' },
                scene: {
                  xaxis: { title: 'X', gridcolor: '#334155', zerolinecolor: '#334155', showbackground: false },
                  yaxis: { title: 'Y', gridcolor: '#334155', zerolinecolor: '#334155', showbackground: false },
                  zaxis: { title: 'Z', gridcolor: '#334155', zerolinecolor: '#334155', showbackground: false },
                },
                xaxis: { gridcolor: '#334155', zerolinecolor: '#334155' },
                yaxis: { gridcolor: '#334155', zerolinecolor: '#334155' },
                showlegend: true,
                legend: { x: 0, y: 1, bgcolor: 'rgba(30, 41, 59, 0.8)' }
              }}
              useResizeHandler={true}
              style={{ width: "100%", height: "100%" }}
              config={{ responsive: true, displayModeBar: true }}
            />
          )
        ) : (
          graphData.nodes.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#cbd5e1' }}>
              No graph data. Try lowering the similarity threshold.
            </div>
          ) : (
            <ForceGraph2D
              graphData={graphData}
              nodeLabel={node => `${node.name}\n${node.content}`}
              nodeColor={node => {
                const extColors = {
                  'py': '#3b82f6',
                  'js': '#f59e0b',
                  'jsx': '#f59e0b',
                  'ts': '#3b82f6',
                  'tsx': '#3b82f6',
                  'md': '#10b981',
                  'json': '#8b5cf6',
                  'css': '#ec4899',
                  'html': '#ef4444',
                };
                return extColors[node.extension] || '#64748b';
              }}
              nodeRelSize={6}
              linkWidth={link => link.value * 3}
              linkColor={() => 'rgba(99, 102, 241, 0.4)'}
              backgroundColor="rgba(0,0,0,0)"
              width={undefined}
              height={undefined}
            />
          )
        )}
      </div>
    </div>
  );
}
