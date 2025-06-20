import { useEffect, useRef, useState, useCallback } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { TinyMCEBinding } from '../utils/TinyMCEBinding';
import { useAuth } from '../contexts/AuthContext';

export const useYjs = (noteId, editorRef) => {
  const [isConnected, setIsConnected] = useState(false);
  const [collaborators, setCollaborators] = useState([]);
  const docRef = useRef(null);
  const providerRef = useRef(null);
  const bindingRef = useRef(null);
  const awarenessTimeoutRef = useRef(null);
  const { user } = useAuth();

  // Throttled collaborator update function
  const updateCollaborators = useCallback((awareness) => {
    // Clear existing timeout
    if (awarenessTimeoutRef.current) {
      clearTimeout(awarenessTimeoutRef.current);
    }
    
    // Set new timeout to batch updates
    awarenessTimeoutRef.current = setTimeout(() => {
      const states = Array.from(awareness.getStates().values());
      const activeUsers = states
        .filter(state => state.user && state.user.id !== user.id) // Exclude current user
        .map(state => ({
          user_identifier: `user_${state.user.id}`,
          user_name: state.user.name,
          color: state.user.color
        }));
      
      // Only update if the collaborators actually changed
      setCollaborators(prevCollaborators => {
        const hasChanged = JSON.stringify(prevCollaborators) !== JSON.stringify(activeUsers);
        if (hasChanged) {
          console.log('👥 Active collaborators updated:', activeUsers.length);
          return activeUsers;
        }
        return prevCollaborators;
      });
    }, 500); // 500ms throttle
  }, [user.id]);

  useEffect(() => {
    if (!noteId || !user || !editorRef.current) return;

    console.log('🚀 Initializing Yjs for note:', noteId);

    // Create Yjs document
    const ydoc = new Y.Doc();
    docRef.current = ydoc;
    
    // Define text type for the editor content
    const ytext = ydoc.getText('tinymce');

    // Set up WebSocket connection
    const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
    const wsProtocol = apiUrl.startsWith('https') ? 'wss' : 'ws';
    const wsHost = apiUrl.replace(/^https?:\/\//, '');
    const wsUrl = `${wsProtocol}://${wsHost}/ws/yjs/${noteId}/?user_id=${user.id}`;
    
    console.log('🔗 Connecting to WebSocket URL:', wsUrl);

    const provider = new WebsocketProvider(
      wsUrl,
      '', // Empty room name since we included everything in the URL
      ydoc,
      {
        connect: true,
        maxBackoffTime: 5000,
        resyncInterval: -1 // Disable automatic resync to reduce updates
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

    // Bind TinyMCE to Yjs only once
    console.log('🔄 Binding TinyMCE editor to Yjs');
    const binding = new TinyMCEBinding(ytext, editorRef.current, awareness);
    bindingRef.current = binding;

    return () => {
      console.log('🧹 Cleaning up Yjs resources');
      
      // Clear awareness timeout
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
  }, [noteId, user?.id]); // Remove editorRef.current dependency to prevent re-initialization

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