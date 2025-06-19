import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext'; // Import auth context

export const useWebSocket = (noteId, onContentChange, onCollaboratorsUpdate, onCursorUpdate) => {
  const ws = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [collaborators, setCollaborators] = useState([]);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const { user } = useAuth(); // Get user from context

  useEffect(() => {
    if (!noteId || !user) return; // Don't connect if no user

    const connect = () => {
      // Don't reconnect if we're already connected or attempting to connect
      if (ws.current?.readyState === WebSocket.CONNECTING || 
          ws.current?.readyState === WebSocket.OPEN) {
        return;
      }

      const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
      const wsProtocol = apiUrl.startsWith('https') ? 'wss' : 'ws';
      const wsHost = apiUrl.replace(/^https?:\/\//, '');
      
      // Add user ID to WebSocket URL for authentication
      const wsUrl = `${wsProtocol}://${wsHost}/ws/note/${noteId}/?user_id=${user.id}`;
      
      console.log('Connecting to WebSocket:', wsUrl);
      
      ws.current = new WebSocket(wsUrl);

      ws.current.onopen = () => {
        setIsConnected(true);
        reconnectAttemptsRef.current = 0;
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
        
        // Handle authentication errors
        if (event.code === 4001) {
          console.error('Authentication required for WebSocket');
          return; // Don't reconnect
        }
        if (event.code === 4003) {
          console.error('Permission denied for WebSocket');
          return; // Don't reconnect
        }
        
        // Only try to reconnect for network issues and if we haven't exceeded attempts
        if (event.code === 1006 && reconnectAttemptsRef.current < 3) {
          reconnectAttemptsRef.current++;
          const delay = Math.min(2000 * reconnectAttemptsRef.current, 8000);
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
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      
      if (ws.current) {
        ws.current.close(1000, 'Component unmounting');
      }
    };
  }, [noteId, user, onContentChange, onCollaboratorsUpdate, onCursorUpdate]); // Add user dependency

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