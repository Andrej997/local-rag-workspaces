/**
 * WebSocket hook for real-time progress updates.
 */
import { useEffect, useRef, useCallback } from 'react';
import { useIndexing } from '../context/IndexingContext';

// Determine WebSocket URL based on environment
const getWebSocketURL = () => {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;

  // In development with Vite proxy, use localhost:8000 directly
  // In production with Docker/nginx, use the same host
  if (host.includes('localhost:5173') || host.includes('127.0.0.1:5173')) {
    return 'ws://localhost:8000/ws/indexing';
  }

  return `${protocol}//${host}/ws/indexing`;
};

const WS_URL = getWebSocketURL();
const RECONNECT_DELAY = 3000;
const MAX_RECONNECT_ATTEMPTS = 5;

export function useWebSocket() {
  const { dispatch } = useIndexing();
  const wsRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef(null);

  /**
   * Handle incoming WebSocket messages
   */
  const handleMessage = useCallback(
    (event) => {
      try {
        const message = JSON.parse(event.data);
        const { type, data } = message;

        switch (type) {
          case 'started':
          case 'counting_files':
          case 'files_counted':
            dispatch({ type: 'INDEXING_STARTED' });
            dispatch({
              type: 'PROGRESS_UPDATE',
              payload: {
                filesTotal: data.files_total || 0,
                filesProcessed: data.files_processed || 0,
                currentFile: data.current_file || '',
                percentage: data.percentage || 0,
              },
            });
            break;

          case 'file_started':
          case 'file_completed':
          case 'chunk_processed':
            dispatch({
              type: 'PROGRESS_UPDATE',
              payload: {
                filesTotal: data.files_total || 0,
                filesProcessed: data.files_processed || 0,
                currentFile: data.current_file || '',
                chunksTotal: data.chunks_total || 0,
                percentage: data.percentage || 0,
              },
            });
            break;

          case 'inserting_data':
          case 'creating_index':
            dispatch({
              type: 'PROGRESS_UPDATE',
              payload: {
                currentFile: data.message || '',
                percentage: 95, // Near complete
              },
            });
            break;

          case 'complete':
            dispatch({ type: 'INDEXING_COMPLETE' });
            dispatch({
              type: 'PROGRESS_UPDATE',
              payload: {
                filesTotal: data.files_total || 0,
                filesProcessed: data.files_processed || 0,
                chunksTotal: data.chunks_total || 0,
                percentage: 100,
                currentFile: data.message || 'Complete',
              },
            });
            break;

          case 'stopped':
            dispatch({ type: 'INDEXING_STOPPED' });
            break;

          case 'error':
          case 'file_error':
            dispatch({
              type: 'ERROR',
              payload: data.message || data.error || 'An error occurred',
            });
            break;

          default:
            console.log('Unknown message type:', type, data);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    },
    [dispatch]
  );

  /**
   * Connect to WebSocket
   */
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    dispatch({ type: 'CONNECTION_STATUS', payload: 'connecting' });

    const ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      console.log('WebSocket connected');
      dispatch({ type: 'CONNECTION_STATUS', payload: 'connected' });
      reconnectAttemptsRef.current = 0;
    };

    ws.onmessage = handleMessage;

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      dispatch({ type: 'CONNECTION_STATUS', payload: 'disconnected' });
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
      dispatch({ type: 'CONNECTION_STATUS', payload: 'disconnected' });

      // Attempt to reconnect
      if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttemptsRef.current += 1;
        console.log(
          `Reconnecting... (attempt ${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS})`
        );

        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, RECONNECT_DELAY);
      } else {
        console.error('Max reconnection attempts reached');
        dispatch({
          type: 'ERROR',
          payload: 'Lost connection to server. Please refresh the page.',
        });
      }
    };

    wsRef.current = ws;
  }, [handleMessage, dispatch]);

  /**
   * Disconnect from WebSocket
   */
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  /**
   * Send stop command to WebSocket
   */
  const sendStopCommand = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send('stop');
    }
  }, []);

  /**
   * Connect on mount, disconnect on unmount
   */
  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    connect,
    disconnect,
    sendStopCommand,
  };
}
