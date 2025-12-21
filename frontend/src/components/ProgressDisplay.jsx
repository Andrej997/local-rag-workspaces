/**
 * Progress display component with progress bar and statistics.
 */
import { useIndexing } from '../context/IndexingContext';

export function ProgressDisplay() {
  const { state } = useIndexing();
  const { progress, isIndexing } = state;

  if (!isIndexing && progress.percentage === 0) {
    return null;
  }

  const isComplete = progress.percentage === 100;

  return (
    <div className="progress-display">
      <h3>{isComplete ? 'Indexing Complete!' : 'Indexing in Progress...'}</h3>

      <div className="progress-bar-container">
        <div className="progress-bar-bg">
          <div
            className="progress-bar-fill"
            style={{ width: `${progress.percentage}%` }}
          >
            <span className="progress-percentage">{progress.percentage.toFixed(1)}%</span>
          </div>
        </div>
      </div>

      <div className="progress-stats">
        <div className="stat">
          <label>Files Processed:</label>
          <value>
            {progress.filesProcessed} / {progress.filesTotal}
          </value>
        </div>

        {progress.chunksTotal > 0 && (
          <div className="stat">
            <label>Total Chunks:</label>
            <value>{progress.chunksTotal.toLocaleString()}</value>
          </div>
        )}

        {progress.currentFile && !isComplete && (
          <div className="stat current-file">
            <label>Current File:</label>
            <value className="file-name">{progress.currentFile}</value>
          </div>
        )}
      </div>

      {isComplete && (
        <div className="completion-message">
          Successfully indexed {progress.filesTotal} files with {progress.chunksTotal.toLocaleString()} chunks!
        </div>
      )}

      {state.connectionStatus === 'disconnected' && isIndexing && (
        <div className="connection-warning">
          Connection lost. Attempting to reconnect...
        </div>
      )}
    </div>
  );
}
