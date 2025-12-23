import { useState, useEffect } from 'react';

/**
 * Custom hook for managing chat sessions
 * Handles session fetching, creation, and selection
 */
export function useChatSessions(apiBaseUrl, bucketName) {
  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);

  // Load sessions when bucket changes
  useEffect(() => {
    if (bucketName) {
      fetchSessions();
    }
  }, [bucketName]);

  const fetchSessions = async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/search/sessions/${bucketName}`);
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

  const createNewSession = async () => {
    if (!bucketName) return null;
    try {
      const res = await fetch(`${apiBaseUrl}/search/sessions/${bucketName}/new`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data.session_id) {
        setCurrentSessionId(data.session_id);
        fetchSessions(); // Refresh list
        return data.session_id;
      }
    } catch (err) {
      console.error("Failed to create new session", err);
      return null;
    }
  };

  const loadSessionHistory = async (sessionId) => {
    try {
      const res = await fetch(`${apiBaseUrl}/search/sessions/${bucketName}/${sessionId}`);
      const data = await res.json();
      return data.history || [];
    } catch (err) {
      console.error("Failed to load history", err);
      return [];
    }
  };

  return {
    sessions,
    currentSessionId,
    setCurrentSessionId,
    createNewSession,
    loadSessionHistory,
    refreshSessions: fetchSessions
  };
}
