import { useEffect, useRef, useState } from 'react';

export const useWebSocket = (noteId, onContentChange, onCollaboratorsUpdate, onCursorUpdate) => {
  const ws = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [collaborators, setCollaborators] = useState([]);

  useEffect(() => {
    if (!noteId) return;

    // Create WebSocket connection
    const wsUrl = `ws://${import.meta.env.VITE_API_BASE_URL}/ws/note/${noteId}/`;
    ws.current = new WebSocket(wsUrl);

    ws.current.onopen = () => {
      setIsConnected(true);
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

    ws.current.onclose = () => {
      setIsConnected(false);
      console.log('WebSocket disconnected');
    };

    ws.current.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    return () => {
      if (ws.current) {
        ws.current.close();
      }
    };
  }, [noteId]);

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