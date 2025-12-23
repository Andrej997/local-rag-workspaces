import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { useConfig } from '../hooks/useConfig';
import './ProjectChat.css';

const API_BASE_URL = 'http://localhost:8000/api';

export function ProjectChat() {
  const { currentBucket } = useConfig();
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  
  const messagesEndRef = useRef(null);

  // Load sessions on mount or bucket change
  useEffect(() => {
    if (currentBucket) {
      fetchSessions();
    }
  }, [currentBucket]);

  // Load history when session changes
  useEffect(() => {
    if (currentBucket && currentSessionId) {
      loadSessionHistory(currentSessionId);
    }
  }, [currentSessionId, currentBucket]);

  const fetchSessions = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/search/sessions/${currentBucket.name}`);
      const data = await res.json();
      if (data.sessions && data.sessions.length > 0) {
        setSessions(data.sessions);
        // Default to latest session if none selected
        if (!currentSessionId) setCurrentSessionId(data.sessions[0].id);
      }
    } catch (err) {
      console.error("Failed to load sessions", err);
    }
  };

  const loadSessionHistory = async (sessionId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/search/sessions/${currentBucket.name}/${sessionId}`);
      const data = await res.json();
      if (data.history) {
        setMessages(data.history);
        scrollToBottom();
      }
    } catch (err) {
      console.error("Failed to load history", err);
    }
  };

  const handleNewChat = async () => {
    if (!currentBucket) return;
    try {
      const res = await fetch(`${API_BASE_URL}/search/sessions/${currentBucket.name}/new`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data.session_id) {
        setCurrentSessionId(data.session_id);
        setMessages([]); // Clear view
        fetchSessions(); // Refresh list
      }
    } catch (err) {
      console.error("Failed to create new session", err);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!query.trim() || !currentBucket || isLoading) return;

    const userMessage = { role: 'user', content: query, timestamp: new Date().toISOString() };
    setMessages(prev => [...prev, userMessage]);
    setQuery('');
    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/search/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bucket_name: currentBucket.name,
          query: userMessage.content
        }),
      });

      if (!response.ok) throw new Error('Network response was not ok');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      // Placeholder for AI response
      const assistantMessage = { 
        role: 'assistant', 
        content: '', 
        sources: [], 
        timestamp: new Date().toISOString() 
      };
      
      setMessages(prev => [...prev, assistantMessage]);

      let fullContent = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.type === 'sources') {
                // Update sources immediately
                setMessages(prev => {
                  const newMsgs = [...prev];
                  newMsgs[newMsgs.length - 1].sources = data.sources;
                  return newMsgs;
                });
              } else if (data.type === 'content') {
                fullContent += data.content;
                setMessages(prev => {
                  const newMsgs = [...prev];
                  newMsgs[newMsgs.length - 1].content = fullContent;
                  return newMsgs;
                });
              } else if (data.type === 'error') {
                fullContent += `\n\n**Error:** ${data.message}`;
                setMessages(prev => {
                  const newMsgs = [...prev];
                  newMsgs[newMsgs.length - 1].content = fullContent;
                  return newMsgs;
                });
              }
            } catch (e) {
              console.error('Error parsing SSE data', e);
            }
          }
        }
      }
    } catch (error) {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: `Error: ${error.message}` }
      ]);
    } finally {
      setIsLoading(false);
      scrollToBottom();
    }
  };

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
                  {source.rerank_score ? `Rerank: ${source.rerank_score.toFixed(2)}` : `Sim: ${source.score.toFixed(2)}`}
                </span>
              </div>
              <div className="source-preview">{source.content.substring(0, 150)}...</div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (!currentBucket) return <div className="no-bucket">Please select a space first</div>;

  return (
    <div className="chat-container">
      <div className="chat-sidebar">
        <div className="chat-sidebar-header">
          <h3>Chats</h3>
          <button className="new-chat-btn" onClick={handleNewChat}>+</button>
        </div>
        <div className="session-list">
          {sessions.map(session => (
            <div 
              key={session.id} 
              className={`session-item ${currentSessionId === session.id ? 'active' : ''}`}
              onClick={() => setCurrentSessionId(session.id)}
            >
              💬 Session {session.id}
            </div>
          ))}
        </div>
      </div>

      <div className="chat-main">
        <div className="messages-area">
          {messages.length === 0 ? (
            <div className="empty-state">
              <h2>Ask about your code</h2>
              <p>Hybrid Search (Keyword + Vector) is active.</p>
            </div>
          ) : (
            messages.map((msg, index) => (
              <div key={index} className={`message ${msg.role}`}>
                <div className="message-content">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                  {msg.role === 'assistant' && renderSources(msg.sources)}
                </div>
                <div className="message-meta">{new Date(msg.timestamp).toLocaleTimeString()}</div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={handleSubmit} className="input-area">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask a question about your codebase..."
            disabled={isLoading}
          />
          <button type="submit" disabled={isLoading}>
            {isLoading ? '...' : 'Send'}
          </button>
        </form>
      </div>
    </div>
  );
}