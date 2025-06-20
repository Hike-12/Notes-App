import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

export const useWebSocket = (noteId, onContentChange, onCollaboratorsUpdate) => {
  const ws = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [collaborators, setCollaborators] = useState([]);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const { user } = useAuth();
  const isConnectingRef = useRef(false);

  useEffect(() => {
    if (!noteId || !user || isConnectingRef.current) return;

    const connect = () => {
      // Prevent multiple simultaneous connections
      if (isConnectingRef.current || 
          ws.current?.readyState === WebSocket.CONNECTING || 
          ws.current?.readyState === WebSocket.OPEN) {
        console.log('Connection already exists or in progress');
        return;
      }

      isConnectingRef.current = true; // Mark as connecting

      const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
      const wsProtocol = apiUrl.startsWith('https') ? 'wss' : 'ws';
      const wsHost = apiUrl.replace(/^https?:\/\//, '');
      const wsUrl = `${wsProtocol}://${wsHost}/ws/note/${noteId}/?user_id=${user.id}`;
      
      console.log('Connecting to WebSocket:', wsUrl);
      
      ws.current = new WebSocket(wsUrl);

      ws.current.onopen = () => {
        setIsConnected(true);
        reconnectAttemptsRef.current = 0;
        isConnectingRef.current = false; // Reset connecting flag
        console.log('WebSocket connected successfully');
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
        isConnectingRef.current = false; // Reset connecting flag
        console.log('WebSocket disconnected:', event.code, event.reason);
        
        // Don't reconnect for authentication errors
        if (event.code === 4001 || event.code === 4003) {
          console.error('Authentication/Permission error - not reconnecting');
          return;
        }
        
        // Only reconnect for unexpected disconnections
        if (event.code === 1006 && reconnectAttemptsRef.current < 3) {
          reconnectAttemptsRef.current++;
          const delay = Math.min(3000 * reconnectAttemptsRef.current, 10000);
          console.log(`Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current})`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        }
      };

      ws.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        isConnectingRef.current = false; // Reset on error
      };
    };

    connect();

    return () => {
      console.log('Cleaning up WebSocket connection');
      isConnectingRef.current = false;
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      
      if (ws.current && ws.current.readyState === WebSocket.OPEN) {
        ws.current.close(1000, 'Component unmounting');
      }
      
      ws.current = null;
    };
  }, [noteId, user]);

  const sendContentChange = (content, userId) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({
        type: 'content_change',
        content: content,
        user_id: userId
      }));
    }
  };

  return {
    isConnected,
    collaborators,
    sendContentChange
  };
};