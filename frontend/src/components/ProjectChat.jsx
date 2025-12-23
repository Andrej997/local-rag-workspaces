import { useState, useRef, useEffect } from 'react';
import { useIndexing } from '../context/IndexingContext';
import { getApiBaseUrl } from '../services/api';
import { useChatSessions } from '../hooks/useChatSessions';
import { ChatMessage } from './ChatMessage';
import { ChatSidebar } from './ChatSidebar';
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
    loadSessionHistory
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
    }
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