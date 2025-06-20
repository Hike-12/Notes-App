import { useEffect, useRef, useState, useCallback } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { QuillBinding } from 'y-quill';
import { useAuth } from '../contexts/AuthContext';

export const useYjs = (noteId, quillRef) => {
  const [isConnected, setIsConnected] = useState(false);
  const [collaborators, setCollaborators] = useState([]);
  const docRef = useRef(null);
  const providerRef = useRef(null);
  const bindingRef = useRef(null);
  const awarenessTimeoutRef = useRef(null);
  const { user } = useAuth();

  // Throttled collaborator update function
  const updateCollaborators = useCallback((awareness) => {
    if (awarenessTimeoutRef.current) {
      clearTimeout(awarenessTimeoutRef.current);
    }
    
    awarenessTimeoutRef.current = setTimeout(() => {
      const states = Array.from(awareness.getStates().values());
      const activeUsers = states
        .filter(state => state.user && state.user.id !== user.id)
        .map(state => ({
          user_identifier: `user_${state.user.id}`,
          user_name: state.user.name,
          color: state.user.color
        }));
      
      setCollaborators(prevCollaborators => {
        const hasChanged = JSON.stringify(prevCollaborators) !== JSON.stringify(activeUsers);
        if (hasChanged) {
          console.log('👥 Active collaborators updated:', activeUsers.length);
          return activeUsers;
        }
        return prevCollaborators;
      });
    }, 500);
  }, [user.id]);

  useEffect(() => {
    if (!noteId || !user || !quillRef.current) return;

    console.log('🚀 Initializing Yjs with Quill for note:', noteId);

    // Create Yjs document
    const ydoc = new Y.Doc();
    docRef.current = ydoc;
    
    // Define text type for the editor content
    const ytext = ydoc.getText('quill');

    // Set up WebSocket connection
    const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
    const wsProtocol = apiUrl.startsWith('https') ? 'wss' : 'ws';
    const wsHost = apiUrl.replace(/^https?:\/\//, '');
    const wsUrl = `${wsProtocol}://${wsHost}/ws/yjs/${noteId}/?user_id=${user.id}`;
    
    console.log('🔗 Connecting to WebSocket URL:', wsUrl);

    const provider = new WebsocketProvider(
      wsUrl,
      '',
      ydoc,
      {
        connect: true,
        maxBackoffTime: 5000,
        resyncInterval: -1
      }
    );
    providerRef.current = provider;

    // Setup awareness (for cursor sharing)
    const awareness = provider.awareness;
    
    // Get collaborator info
    const collaboratorColor = user.color || getRandomColor();
    const userName = user.username || user.first_name || `User-${user.id}`;
    
    awareness.setLocalStateField('user', {
      name: userName,
      color: collaboratorColor,
      id: user.id
    });

    console.log('🎨 Setting user awareness:', { name: userName, color: collaboratorColor });

    // Listen for connections
    provider.on('status', ({ status }) => {
      console.log('📡 Yjs connection status:', status);
      setIsConnected(status === 'connected');
    });

    // Listen for awareness updates with throttling
    awareness.on('change', () => {
      updateCollaborators(awareness);
    });

    // Bind Quill to Yjs - this handles everything!
    console.log('🔄 Binding Quill editor to Yjs');
    const binding = new QuillBinding(ytext, quillRef.current, awareness);
    bindingRef.current = binding;

    return () => {
      console.log('🧹 Cleaning up Yjs resources');
      
      if (awarenessTimeoutRef.current) {
        clearTimeout(awarenessTimeoutRef.current);
      }
      
      if (bindingRef.current) {
        bindingRef.current.destroy();
      }
      if (providerRef.current) {
        providerRef.current.disconnect();
      }
      if (docRef.current) {
        docRef.current.destroy();
      }
    };
  }, [noteId, user?.id]);

  return {
    isConnected,
    collaborators
  };
};

// Helper function to generate random colors
function getRandomColor() {
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', 
    '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F'
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}