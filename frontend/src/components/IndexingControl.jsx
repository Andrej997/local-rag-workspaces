/**
 * Indexing control buttons component.
 */
import { useState } from 'react';
import { indexingAPI } from '../services/api';
import { useIndexing } from '../context/IndexingContext';

export function IndexingControl() {
  const { state, dispatch } = useIndexing();
  // FIX: Access currentBucket from state, not directly from the context root
  const { currentBucket } = state; 
  
  const [startLoading, setStartLoading] = useState(false);
  const [stopLoading, setStopLoading] = useState(false);

  const handleStart = async () => {
    if (!currentBucket) {
      alert("Please select a project (bucket) first.");
      return;
    }

    setStartLoading(true);
    dispatch({ type: 'CLEAR_ERROR' });

    try {
      await indexingAPI.start();
      dispatch({ type: 'INDEXING_STARTED' });
    } catch (error) {
      console.error('Failed to start indexing:', error);
      dispatch({
        type: 'ERROR',
        payload: error.response?.data?.detail || 'Failed to start indexing',
      });
    } finally {
      setStartLoading(false);
    }
  };

  const handleStop = async () => {
    setStopLoading(true);

    try {
      await indexingAPI.stop();
      dispatch({ type: 'INDEXING_STOPPED' });
    } catch (error) {
      console.error('Failed to stop indexing:', error);
      dispatch({
        type: 'ERROR',
        payload: error.response?.data?.detail || 'Failed to stop indexing',
      });
    } finally {
      setStopLoading(false);
    }
  };

  return (
    <div className="indexing-control" style={{ marginTop: '20px', padding: '15px', borderTop: '1px solid #eee' }}>
      {!state.isIndexing ? (
        <button
          onClick={handleStart}
          // The button relies on currentBucket being truthy
          disabled={startLoading || !currentBucket}
          className="btn btn-success btn-large"
          title={!currentBucket ? "Select a project first" : "Start Indexing"}
        >
          {startLoading ? 'Starting...' : 'Start Indexing'}
        </button>
      ) : (
        <button
          onClick={handleStop}
          disabled={stopLoading}
          className="btn btn-danger btn-large"
        >
          {stopLoading ? 'Stopping...' : 'Stop Indexing'}
        </button>
      )}

      {!currentBucket && !state.isIndexing && (
        <div className="warning-message" style={{ color: '#d32f2f', marginTop: '10px' }}>
          <small>Please create or select a project above to start indexing.</small>
        </div>
      )}
    </div>
  );
}