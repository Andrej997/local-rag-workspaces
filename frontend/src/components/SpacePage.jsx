import { useState } from 'react';
import { useIndexing } from '../context/IndexingContext';
import { useNotification } from '../context/NotificationContext';
import { bucketAPI, indexingAPI } from '../services/api';
import { useWebSocket } from '../hooks/useWebSocket';
import { ProgressDisplay } from './ProgressDisplay';
import { FileViewer } from './FileViewer';
import { FileTree } from './FileTree';
import { UploadPanel } from './UploadPanel';
import { GuideModal } from './GuideModal';

export function SpacePage() {
  const { state, refreshBuckets } = useIndexing();
  const { notify } = useNotification();
  const { currentBucket, indexingStatus } = state;
  const [isStarting, setIsStarting] = useState(false);
  const [viewingFile, setViewingFile] = useState(null);

  // Activate WebSocket to listen for progress/errors
  useWebSocket();

  if (!currentBucket) {
    return <div className="card" style={{ padding: '2rem' }}>No space selected. Please create or select a space.</div>;
  }

  const handleStartIndexing = async () => {
    setIsStarting(true);
    try {
      await indexingAPI.start(currentBucket.name);
      notify.success('Indexing started successfully');
    } catch (err) {
      notify.error("Failed to start indexing: " + (err.response?.data?.detail || err.message));
    } finally {
      setIsStarting(false);
    }
  };

  const handleStopIndexing = async () => {
    try {
      await indexingAPI.stop();
      notify.info('Indexing stopped');
    } catch (err) {
      notify.error("Failed to stop: " + err.message);
    }
  };

  const isRunning = indexingStatus?.is_running;

  const guideContent = {
    title: "Space Management Guide",
    sections: [
      {
        icon: "📂",
        title: "Content Sources",
        color: "#3b82f6",
        description: "Manage the documents and files that power your space:",
        items: [
          { label: "Upload Files", text: "Drag & drop or click to add individual files" },
          { label: "Add Folders", text: "Upload entire directories for bulk processing" },
          { label: "File Tree", text: "Browse and preview indexed content" },
          { label: "Delete Sources", text: "Select items and remove unwanted files" }
        ]
      },
      {
        icon: "⚡",
        title: "Indexing Process",
        color: "#10b981",
        description: "Transform your documents into searchable embeddings:",
        steps: [
          { label: "Upload Content", text: "Add files to your space first" },
          { label: "Start Indexing", text: "Click 'Start Indexing' to process files" },
          { label: "Monitor Progress", text: "Watch real-time updates in progress panel" },
          { label: "Ready to Search", text: "Once complete, files are searchable in Chat" }
        ]
      },
      {
        icon: "🎯",
        title: "Status Indicators",
        color: "#f59e0b",
        items: [
          { label: "Green Badge", text: "Indexing currently running" },
          { label: "Gray Badge", text: "System ready to start indexing" },
          { label: "Progress Bar", text: "Shows percentage of files processed" },
          { label: "Success Checkmark", text: "All files indexed successfully" }
        ]
      },
      {
        icon: "💡",
        title: "Pro Tips",
        color: "#8b5cf6",
        items: [
          { label: "Re-indexing", text: "Upload new files and run indexing again to add them" },
          { label: "File Formats", text: "Supports .txt, .md, .pdf, .doc, .docx, and more" },
          { label: "WebSocket Updates", text: "Progress updates stream in real-time" },
          { label: "Stop Anytime", text: "You can safely stop indexing and resume later" }
        ]
      }
    ]
  };

  return (
    <div className="space-page" style={{ padding: '1.5rem', maxWidth: '1200px', margin: '0 auto' }}>

      {/* Header Section */}
      <div className="page-header" style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>{currentBucket.name}</h1>
          <div style={{ color: '#94a3b8' }}>
            Manage content sources and indexing
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <GuideModal title={guideContent.title} sections={guideContent.sections} />

          {/* Indexing Status Badge - Only show when running */}
          {isRunning && (
            <div style={{
              padding: '0.5rem 1rem',
              borderRadius: '2rem',
              background: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid #10b981',
              color: '#10b981',
              display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: '500'
            }}>
              <div style={{
                width: '8px', height: '8px', borderRadius: '50%',
                background: '#10b981',
                boxShadow: '0 0 8px #10b981'
              }}></div>
              Indexing in Progress
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gap: '1.5rem', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))' }}>

        {/* LEFT COLUMN: Sources List & Upload */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 200px)' }}>
            <h3 style={{ borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem', marginBottom: '1rem', flexShrink: 0 }}>
              📂 Indexed Paths / Sources
            </h3>

            {/* File Tree Display with Scroll */}
            <div
              className="file-tree-scroll"
              style={{
                overflowY: 'auto',
                overflowX: 'hidden',
                flex: 1,
                minHeight: '200px',
                paddingRight: '0.5rem'
              }}
            >
              {(!currentBucket.files || currentBucket.files.length === 0) ? (
                <p style={{ color: '#64748b', fontStyle: 'italic' }}>No sources added yet. Upload files or folders below.</p>
              ) : (
                <FileTree
                  files={currentBucket.files}
                  bucketName={currentBucket.name}
                  onDelete={(paths) => {
                    if (confirm(`Remove ${paths.length} item(s)?`)) {
                      bucketAPI.removeDirectories(currentBucket.name, paths)
                        .then(() => {
                          refreshBuckets();
                          notify.success('Files removed successfully');
                        })
                        .catch(err => notify.error("Failed to remove: " + err.message));
                    }
                  }}
                  onView={(filePath, fileName) => {
                    setViewingFile({ filePath, fileName });
                  }}
                />
              )}
            </div>

            {/* Upload Section - Fixed at bottom */}
            <UploadPanel
              bucketName={currentBucket.name}
              onUploadComplete={refreshBuckets}
            />
          </div>
        </div>

        {/* RIGHT COLUMN: Actions & Progress */}
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

            {/* Indexing Status Message */}
            {!isRunning && state.progress.percentage === 100 && (
              <div style={{
                padding: '0.75rem 1rem',
                borderRadius: '0.5rem',
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid #10b981',
                color: '#10b981',
                marginBottom: '1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontWeight: '500'
              }}>
                <span style={{ fontSize: '1.2rem' }}>✓</span>
                <span>All files have been indexed successfully</span>
              </div>
            )}

            {/* PROGRESS DISPLAY COMPONENT */}
            <div style={{ background: 'var(--bg-primary)', borderRadius: '0.5rem', border: '1px solid var(--border)', minHeight: '100px' }}>
              <ProgressDisplay />
            </div>
          </div>

        </div>

      </div>

      {/* File Viewer Modal */}
      {viewingFile && (
        <FileViewer
          bucketName={currentBucket.name}
          filePath={viewingFile.filePath}
          fileName={viewingFile.fileName}
          onClose={() => setViewingFile(null)}
        />
      )}
    </div>
  );
}