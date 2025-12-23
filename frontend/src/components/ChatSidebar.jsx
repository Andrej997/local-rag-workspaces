/**
 * ChatSidebar Component
 * Displays the list of chat sessions and allows creating new sessions
 */
export function ChatSidebar({ sessions, currentSessionId, onSessionSelect, onNewChat }) {
  return (
    <div className="chat-sidebar">
      <div className="chat-sidebar-header">
        <h3>Chats</h3>
        <button className="new-chat-btn" onClick={onNewChat}>+</button>
      </div>
      <div className="session-list">
        {sessions.map(session => (
          <div
            key={session.id}
            className={`session-item ${currentSessionId === session.id ? 'active' : ''}`}
            onClick={() => onSessionSelect(session.id)}
          >
            💬 Session {session.id}
          </div>
        ))}
      </div>
    </div>
  );
}
