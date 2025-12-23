import ReactMarkdown from 'react-markdown';

/**
 * ChatMessage Component
 * Renders a single chat message with optional sources
 */
export function ChatMessage({ message }) {
  const { role, content, sources, timestamp } = message;

  const getSourceBadge = (source) => {
    if (source.type === 'bm25') return <span className="badge badge-bm25">Keyword</span>;
    if (source.type === 'vector') return <span className="badge badge-vector">Vector</span>;
    return <span className="badge badge-default">Context</span>;
  };

  const renderSources = (sources) => {
    if (!sources || sources.length === 0) return null;
    return (
      <div className="sources-container">
        <div className="sources-title">📚 Used {sources.length} sources:</div>
        <div className="sources-list">
          {sources.map((source, idx) => (
            <div key={idx} className="source-item" title={source.content}>
              <div className="source-header">
                {getSourceBadge(source)}
                <span className="source-filename">{source.filename}</span>
                <span className="source-score">
                  {source.rerank_score
                    ? `Rerank: ${source.rerank_score.toFixed(2)}`
                    : `Sim: ${source.score.toFixed(2)}`
                  }
                </span>
              </div>
              <div className="source-preview">{source.content.substring(0, 150)}...</div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className={`message ${role}`}>
      <div className="message-content">
        <ReactMarkdown>{content}</ReactMarkdown>
        {role === 'assistant' && renderSources(sources)}
      </div>
      <div className="message-meta">
        {new Date(timestamp).toLocaleTimeString()}
      </div>
    </div>
  );
}
