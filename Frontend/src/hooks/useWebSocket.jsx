import { useEffect, useRef, useState } from 'react';

export const useWebSocket = (noteId, onContentChange, onCollaboratorsUpdate, onCursorUpdate) => {
  const ws = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [collaborators, setCollaborators] = useState([]);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);

  useEffect(() => {
    if (!noteId) return;

    const connect = () => {
      // Don't reconnect if we're already connected or attempting to connect
      if (ws.current?.readyState === WebSocket.CONNECTING || 
          ws.current?.readyState === WebSocket.OPEN) {
        return;
      }

      const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
      const wsProtocol = apiUrl.startsWith('https') ? 'wss' : 'ws';
      const wsHost = apiUrl.replace(/^https?:\/\//, '');
      const wsUrl = `${wsProtocol}://${wsHost}/ws/note/${noteId}/`;
      
      console.log('Connecting to WebSocket:', wsUrl);
      
      ws.current = new WebSocket(wsUrl);

      ws.current.onopen = () => {
        setIsConnected(true);
        reconnectAttemptsRef.current = 0; // Reset attempts on successful connection
        console.log('WebSocket connected');
      };

      ws.current.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        switch (data.type) {
          case 'content_change':
            if (onContentChange) {
              onContentChange(data.content, data.user_id);
            }
            break;
          case 'collaborators_update':
            setCollaborators(data.collaborators);
            if (onCollaboratorsUpdate) {
              onCollaboratorsUpdate(data.collaborators);
            }
            break;
          case 'cursor_position':
            if (onCursorUpdate) {
              onCursorUpdate(data.position, data.user_id, data.user_name, data.color);
            }
            break;
          case 'note_saved':
            console.log('Note saved by another user');
            break;
          case 'note_deleted':
            alert('This note has been deleted by another user');
            window.location.href = '/';
            break;
        }
      };

      ws.current.onclose = (event) => {
        setIsConnected(false);
        console.log('WebSocket disconnected:', event.code, event.reason);
        
        // Only try to reconnect if it's not a normal closure and we haven't exceeded attempts
        if (event.code !== 1000 && reconnectAttemptsRef.current < 5) {
          reconnectAttemptsRef.current++;
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 10000); // Exponential backoff
          console.log(`Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current})`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        }
      };

      ws.current.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
    };

    connect();

    return () => {
      // Clear any pending reconnection
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      
      if (ws.current) {
        ws.current.close(1000, 'Component unmounting'); // Normal closure
      }
    };
  }, [noteId, onContentChange, onCollaboratorsUpdate, onCursorUpdate]);

  const sendContentChange = (content, userId) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({
        type: 'content_change',
        content: content,
        user_id: userId
      }));
    }
  };

  const sendCursorPosition = (position, userId, userName, color) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({
        type: 'cursor_position',
        position: position,
        user_id: userId,
        user_name: userName,
        color: color
      }));
    }
  };

  return {
    isConnected,
    collaborators,
    sendContentChange,
    sendCursorPosition
  };
};