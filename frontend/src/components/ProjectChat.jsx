import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { searchAPI } from '../services/api';
import { useIndexing } from '../context/IndexingContext';
import './ProjectChat.css';

export function ProjectChat() {
  const { state } = useIndexing();
  const { currentBucket } = state;

  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const messagesEndRef = useRef(null);

  // Load sessions and history when bucket changes
  useEffect(() => {
    if (currentBucket) {
      loadSessions();
      loadHistory();
    } else {
      setMessages([]);
      setSessions([]);
      setCurrentSessionId(null);
    }
  }, [currentBucket?.name]);

  const loadSessions = async () => {
    try {
      const res = await searchAPI.getSessions(currentBucket.name);
      setSessions(res.data.sessions || []);
      // Set current session to the latest if not already set
      if (res.data.sessions && res.data.sessions.length > 0 && !currentSessionId) {
        setCurrentSessionId(res.data.sessions[0].id);
      }
    } catch (err) {
      console.error("Failed to load sessions", err);
    }
  };

  const loadHistory = async () => {
    try {
      const res = await searchAPI.getHistory(currentBucket.name);
      if (res.data.history && res.data.history.length > 0) {
        setMessages(res.data.history);
      } else {
        setMessages([{ role: 'system', content: `Ready to chat about **${currentBucket.name}**. Ask me anything!` }]);
      }
    } catch (err) {
      console.error("Failed to load history", err);
    }
  };

  const handleNewChat = async () => {
    if (!currentBucket) return;
    try {
      const res = await searchAPI.createNewSession(currentBucket.name);
      setCurrentSessionId(res.data.session_id);
      setMessages([{ role: 'system', content: `Ready to chat about **${currentBucket.name}**. Ask me anything!` }]);
      await loadSessions(); // Refresh session list
    } catch (err) {
      console.error("Failed to create new session", err);
    }
  };

  const handleSessionChange = async (e) => {
    const sessionId = parseInt(e.target.value);
    if (!sessionId || !currentBucket) return;

    try {
      const res = await searchAPI.loadSession(currentBucket.name, sessionId);
      setCurrentSessionId(sessionId);
      setMessages(res.data.history || []);
    } catch (err) {
      console.error("Failed to load session", err);
    }
  };

  const handleClear = async () => {
    if (!currentBucket) return;
    if (confirm("Are you sure you want to start a new chat session?")) {
      const res = await searchAPI.clearHistory(currentBucket.name);
      setCurrentSessionId(res.data.new_session_id);
      await loadSessions();
      loadHistory(); // Reset to system message
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || !currentBucket || loading) return;

    const userMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    // Create a placeholder for the assistant message
    const assistantMessageIndex = messages.length + 1;
    setMessages(prev => [...prev, {
      role: 'assistant',
      content: '',
      sources: []
    }]);

    try {
      const response = await fetch('http://localhost:8000/api/search/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bucket_name: currentBucket.name,
          query: userMessage.content
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6));

            if (data.type === 'sources') {
              setMessages(prev => {
                const newMessages = [...prev];
                newMessages[assistantMessageIndex] = {
                  ...newMessages[assistantMessageIndex],
                  sources: data.sources
                };
                return newMessages;
              });
            } else if (data.type === 'content') {
              setMessages(prev => {
                const newMessages = [...prev];
                newMessages[assistantMessageIndex] = {
                  ...newMessages[assistantMessageIndex],
                  content: newMessages[assistantMessageIndex].content + data.content
                };
                return newMessages;
              });
            } else if (data.type === 'error') {
              setMessages(prev => {
                const newMessages = [...prev];
                newMessages[assistantMessageIndex] = {
                  role: 'error',
                  content: "Error: " + data.message
                };
                return newMessages;
              });
              setLoading(false);
            } else if (data.type === 'done') {
              setLoading(false);
            }
          }
        }
      }
    } catch (err) {
      console.error(err);
      setMessages(prev => {
        const newMessages = [...prev];
        newMessages[assistantMessageIndex] = {
          role: 'error',
          content: "Error: " + (err.message || "Failed to search codebase.")
        };
        return newMessages;
      });
      setLoading(false);
    }
  };

  if (!currentBucket) {
    return (
      <div className="chat-empty-state">
        <div className="empty-icon">📂</div>
        <h2>No Space Selected</h2>
        <p>Please select a space in the sidebar to start chatting.</p>
      </div>
    );
  }

  return (
    <div className="chat-container">
      <div className="chat-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
          <h1>Chat with {currentBucket.name}</h1>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            {sessions.length > 0 && (
              <select
                value={currentSessionId || ''}
                onChange={handleSessionChange}
                style={{
                  fontSize: '0.85rem',
                  padding: '4px 8px',
                  background: 'white',
                  border: '1px solid #cbd5e1',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                {sessions.map(session => (
                  <option key={session.id} value={session.id}>
                    {session.name}
                  </option>
                ))}
              </select>
            )}

            <button
              onClick={handleNewChat}
              style={{
                fontSize: '0.8rem',
                padding: '4px 12px',
                background: '#2563eb',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              New Chat
            </button>

            <button
              onClick={handleClear}
              style={{
                fontSize: '0.8rem',
                padding: '4px 8px',
                background: 'transparent',
                color: '#ef4444',
                border: '1px solid #ef4444',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      <div className="messages-area">
        {messages.map((msg, index) => (
          <div key={index} className={`message-row ${msg.role}`}>
            <div className="message-bubble">
              {msg.role === 'error' ? (
                <div className="error-text">{msg.content}</div>
              ) : (
                <ReactMarkdown>{msg.content}</ReactMarkdown>
              )}

              {msg.sources && msg.sources.length > 0 && (
                <div className="message-sources">
                  <strong>References:</strong>
                  <ul>
                    {msg.sources.slice(0, 3).map((src, idx) => (
                      <li key={idx}>
                        📄 {src.filename} <span className="score">({(src.score).toFixed(2)})</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="message-row assistant">
            <div className="message-bubble loading-bubble">
              <span className="dot">.</span><span className="dot">.</span><span className="dot">.</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSend} className="chat-input-area">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question about your space..."
          disabled={loading}
          autoFocus
        />
        <button type="submit" disabled={loading || !input.trim()}>
          {loading ? '...' : 'Send'}
        </button>
      </form>
    </div>
  );
}