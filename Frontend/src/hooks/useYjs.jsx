import { useEffect, useRef, useState, useCallback } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { QuillBinding } from 'y-quill';
import QuillCursors from 'quill-cursors';
import Quill from 'quill';
import { useAuth } from '../contexts/AuthContext';

// Register the cursors module
Quill.register('modules/cursors', QuillCursors);

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
    }, 300); // Reduced timeout for faster updates
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
        maxBackoffTime: 3000,
        resyncInterval: -1
      }
    );
    providerRef.current = provider;

    // Setup awareness (for cursor sharing)
    const awareness = provider.awareness;
    
    // Get collaborator info
    const collaboratorColor = user.color || getRandomColor();
    const userName = user.username || user.first_name || `User-${user.id}`;
    
    // Set user awareness with more detailed info
    awareness.setLocalStateField('user', {
      name: userName,
      color: collaboratorColor,
      id: user.id,
      email: user.email,
      initials: (user.first_name?.[0] || '') + (user.last_name?.[0] || ''),
    });

    console.log('🎨 Setting user awareness:', { name: userName, color: collaboratorColor });

    // Listen for connections
    provider.on('status', ({ status }) => {
      console.log('📡 Yjs connection status:', status);
      setIsConnected(status === 'connected');
    });

    // Listen for awareness updates with throttling
    awareness.on('change', ({ added, updated, removed }) => {
      console.log('👀 Awareness change:', { added: added.length, updated: updated.length, removed: removed.length });
      updateCollaborators(awareness);
    });

    // Initialize cursors module
    const cursors = quillRef.current.getModule('cursors');
    if (cursors) {
      console.log('✨ Cursors module initialized');
    }

    // Bind Quill to Yjs with cursors enabled
    console.log('🔄 Binding Quill editor to Yjs with cursors');
    const binding = new QuillBinding(ytext, quillRef.current, awareness);
    bindingRef.current = binding;

    // Enhanced cursor tracking
    awareness.on('change', () => {
      if (!cursors) return;
      
      const states = awareness.getStates();
      const currentUser = awareness.getLocalState()?.user?.id;
      
      // Clear existing cursors
      cursors.clearCursors();
      
      // Add cursors for all other users
      states.forEach((state, clientId) => {
        if (!state.user || state.user.id === currentUser) return;
        
        const cursor = state.cursor;
        if (cursor) {
          cursors.createCursor(
            clientId,
            state.user.name,
            state.user.color
          );
          
          cursors.moveCursor(clientId, cursor);
        }
      });
    });

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
    '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
    '#A8E6CF', '#FFD93D', '#6C5CE7', '#FD79A8'
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}