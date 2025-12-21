import { useState, useEffect, useMemo } from 'react';
import { useIndexing } from '../context/IndexingContext';
import { visualizationAPI } from '../services/api';

// --- CRITICAL FIX: Factory Pattern for Plotly ---
// This prevents Vite bundling issues that cause blank graphs
import Plotly from 'plotly.js/dist/plotly';
import createPlotlyComponent from 'react-plotly.js/factory';
const Plot = createPlotlyComponent(Plotly);

export function IndexVisualization() {
  const { state } = useIndexing();
  const { currentBucket } = state;
  const [points, setPoints] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState('2D'); // '2D' | '3D'
  const [dataDimensions, setDataDimensions] = useState(2);

  useEffect(() => {
    if (currentBucket) {
      fetchData(viewMode === '3D' ? 3 : 2);
    }
  }, [currentBucket, viewMode]);

  const fetchData = async (dim) => {
    setLoading(true);
    setError(null);
    try {
      const res = await visualizationAPI.getData(currentBucket.name, dim);
      
      if (res.data.error) throw new Error(res.data.error);
      if (res.data.message) throw new Error(res.data.message);
      
      const loadedPoints = res.data.points || [];
      setPoints(loadedPoints);
      
      // Check what dimensions the backend actually returned
      // Use the 'dimensions' field from response, or guess based on first point
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

  // Prepare data for Plotly
  const plotData = useMemo(() => {
    const traces = {};
    
    points.forEach(p => {
      // Group by extension for color coding
      const ext = p.filename && p.filename.includes('.') ? p.filename.split('.').pop() : 'other';
      
      if (!traces[ext]) {
        traces[ext] = { 
          x: [], y: [], z: [], 
          text: [],
          type: viewMode === '3D' ? 'scatter3d' : 'scatter',
          mode: 'markers',
          name: ext,
          marker: { size: viewMode === '3D' ? 4 : 8 }
        };
      }
      traces[ext].x.push(p.x);
      traces[ext].y.push(p.y);
      
      // Only push Z if we are in 3D mode AND data has Z
      if (viewMode === '3D') {
        traces[ext].z.push(p.z || 0); // Default to 0 if missing to prevent crash
      }
      
      const safeContent = p.content ? p.content.substring(0, 60).replace(/</g, "&lt;") : "";
      traces[ext].text.push(`<b>${p.filename}</b><br>${safeContent}...`);
    });

    return Object.values(traces);
  }, [points, viewMode]);

  if (!currentBucket) {
    return <div className="card" style={{padding: '2rem'}}>No space selected.</div>;
  }

  return (
    <div className="visualization-page" style={{ padding: '1.5rem', height: '100%', display: 'flex', flexDirection: 'column' }}>
      
      <div className="page-header" style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 'bold' }}>Index Visualization</h1>
          <div style={{ color: '#94a3b8', fontSize: '0.9rem', display: 'flex', gap: '1rem' }}>
             <span>{points.length} vectors</span>
             {viewMode === '3D' && dataDimensions === 2 && (
               <span style={{ color: '#f59e0b' }}>⚠️ Backend returned 2D data (Rebuild Backend for 3D)</span>
             )}
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div style={{ background: '#1e293b', padding: '4px', borderRadius: '8px', border: '1px solid #334155', display: 'flex' }}>
            <button
              onClick={() => setViewMode('2D')}
              style={{
                padding: '6px 16px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                background: viewMode === '2D' ? '#3b82f6' : 'transparent',
                color: viewMode === '2D' ? 'white' : '#94a3b8', fontWeight: 'bold'
              }}
            >
              2D
            </button>
            <button
              onClick={() => setViewMode('3D')}
              style={{
                padding: '6px 16px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                background: viewMode === '3D' ? '#3b82f6' : 'transparent',
                color: viewMode === '3D' ? 'white' : '#94a3b8', fontWeight: 'bold'
              }}
            >
              3D
            </button>
          </div>

          <button 
            onClick={() => fetchData(viewMode === '3D' ? 3 : 2)} 
            disabled={loading}
            style={{ background: '#334155', color: 'white', border: 'none', padding: '0.6rem 1rem', borderRadius: '0.5rem', cursor: 'pointer' }}
          >
            {loading ? 'Refreshing...' : '🔄 Refresh'}
          </button>
        </div>
      </div>

      <div className="card" style={{ flex: 1, padding: '1rem', position: 'relative', height: '600px', width: '100%', minHeight: '500px' }}>
        {loading && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', zIndex: 10 }}>
            <span style={{ color: 'white', fontWeight: 'bold', fontSize: '1.2rem' }}>Processing Vectors...</span>
          </div>
        )}
        
        {error ? (
          <div style={{ padding: '2rem', color: '#ef4444', textAlign: 'center' }}>{error}</div>
        ) : points.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
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
              // 3D Layout settings
              scene: {
                xaxis: { title: 'X', gridcolor: '#334155', zerolinecolor: '#334155', showbackground: false },
                yaxis: { title: 'Y', gridcolor: '#334155', zerolinecolor: '#334155', showbackground: false },
                zaxis: { title: 'Z', gridcolor: '#334155', zerolinecolor: '#334155', showbackground: false },
              },
              // 2D Layout settings
              xaxis: { gridcolor: '#334155', zerolinecolor: '#334155' },
              yaxis: { gridcolor: '#334155', zerolinecolor: '#334155' },
              showlegend: true,
              legend: { x: 0, y: 1, bgcolor: 'rgba(30, 41, 59, 0.8)' }
            }}
            useResizeHandler={true}
            style={{ width: "100%", height: "100%" }} 
            config={{ responsive: true, displayModeBar: true }}
          />
        )}
      </div>
    </div>
  );
}