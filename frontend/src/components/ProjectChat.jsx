import { useState, useRef, useEffect } from 'react';
import { useIndexing } from '../context/IndexingContext';
import { getApiBaseUrl } from '../services/api';
import { useChatSessions } from '../hooks/useChatSessions';
import { ChatMessage } from './ChatMessage';
import { ChatSidebar } from './ChatSidebar';
import { GuideModal } from './GuideModal';
import './ProjectChat.css';

// Get API base URL from environment configuration
const API_BASE_URL = getApiBaseUrl() + '/api';

export function ProjectChat() {
  const { state } = useIndexing();
  const currentBucket = state.currentBucket;
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  // Use custom hook for session management
  const {
    sessions,
    currentSessionId,
    setCurrentSessionId,
    createNewSession,
    loadSessionHistory,
    refreshSessions
  } = useChatSessions(API_BASE_URL, currentBucket?.name);

  // Load history when session changes
  useEffect(() => {
    if (currentBucket && currentSessionId) {
      loadSessionHistory(currentSessionId).then(history => {
        setMessages(history);
        scrollToBottom();
      });
    }
  }, [currentSessionId, currentBucket]);

  const handleNewChat = async () => {
    const newSessionId = await createNewSession();
    if (newSessionId) {
      setMessages([]); // Clear view
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
      // Refresh sessions to show newly created session in sidebar
      refreshSessions();
    }
  };

  const guideContent = {
    title: "Chat Guide",
    sections: [
      {
        icon: "💬",
        title: "How Chat Works",
        color: "#3b82f6",
        description: "Intelligent RAG-powered conversations with your documents:",
        items: [
          { label: "Hybrid Search", text: "Combines keyword (BM25) and semantic (vector) search for best results" },
          { label: "Context-Aware", text: "Uses retrieved document chunks to ground responses" },
          { label: "Streaming Responses", text: "Real-time token-by-token generation for faster feedback" },
          { label: "Source Attribution", text: "Shows which documents were used to answer your query" }
        ]
      },
      {
        icon: "🔍",
        title: "Search Features",
        color: "#10b981",
        items: [
          { label: "Semantic Search", text: "Finds conceptually similar content, not just keyword matches" },
          { label: "BM25 Ranking", text: "Traditional keyword search for exact term matching" },
          { label: "Hybrid Fusion", text: "Combines both methods using Reciprocal Rank Fusion (RRF)" },
          { label: "Configurable K", text: "Adjust number of documents retrieved (set in Settings)" }
        ]
      },
      {
        icon: "🗂️",
        title: "Sessions",
        color: "#f59e0b",
        description: "Organize conversations into separate threads:",
        items: [
          { label: "Multiple Chats", text: "Create new sessions with '+' button in sidebar" },
          { label: "Switch Sessions", text: "Click any session to load its history" },
          { label: "Persistent History", text: "All messages saved automatically per session" },
          { label: "Isolated Context", text: "Each session maintains its own conversation flow" }
        ]
      },
      {
        icon: "📝",
        title: "Usage Tips",
        color: "#8b5cf6",
        steps: [
          { label: "Be Specific", text: "Ask detailed questions for better retrieval accuracy" },
          { label: "Check Sources", text: "Review cited documents to verify response accuracy" },
          { label: "Follow Up", text: "Ask clarifying questions in the same session for context" },
          { label: "Index First", text: "Ensure your files are indexed before chatting (Space page)" }
        ]
      }
    ]
  };

  if (!currentBucket) return <div className="no-bucket">Please select a space first</div>;

  return (
    <div className="chat-container">
      <ChatSidebar
        sessions={sessions}
        currentSessionId={currentSessionId}
        onSessionSelect={setCurrentSessionId}
        onNewChat={handleNewChat}
      />

      <div className="chat-main">
        <div style={{
          padding: '1rem 1.5rem',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'var(--bg-secondary)'
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '600' }}>
              {currentBucket.name}
            </h2>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: '#94a3b8' }}>
              Hybrid Search (Keyword + Vector) is active
            </p>
          </div>
          <GuideModal title={guideContent.title} sections={guideContent.sections} />
        </div>

        <div className="messages-area">
          {messages.length === 0 ? (
            <div className="empty-state">
              <h2>Ask about your code</h2>
              <p>Hybrid Search (Keyword + Vector) is active.</p>
            </div>
          ) : (
            messages.map((msg, index) => (
              <ChatMessage key={index} message={msg} />
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