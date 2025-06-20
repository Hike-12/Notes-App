import { useEffect, useRef, useState } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { TinyMCEBinding } from 'y-tinymce';
import { useAuth } from '../contexts/AuthContext';

export const useYjs = (noteId, editorRef) => {
  const [isConnected, setIsConnected] = useState(false);
  const [collaborators, setCollaborators] = useState([]);
  const docRef = useRef(null);
  const providerRef = useRef(null);
  const bindingRef = useRef(null);
  const { user } = useAuth();

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
    
    // Connect to our custom Yjs WebSocket endpoint
    const provider = new WebsocketProvider(
      `${wsProtocol}://${wsHost}/ws/yjs`, 
      noteId, 
      ydoc,
      { params: { user_id: user.id } } // Use user_id to match our backend
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

    // Listen for awareness updates (collaborators)
    awareness.on('change', () => {
      const states = Array.from(awareness.getStates().values());
      const activeUsers = states
        .filter(state => state.user)
        .map(state => ({
          user_identifier: `user_${state.user.id}`,
          user_name: state.user.name,
          color: state.user.color
        }));
      
      console.log('👥 Active collaborators:', activeUsers);
      setCollaborators(activeUsers);
    });

    // Bind TinyMCE to Yjs
    console.log('🔄 Binding TinyMCE editor to Yjs');
    const binding = new TinyMCEBinding(ytext, editorRef.current, awareness);
    bindingRef.current = binding;

    return () => {
      console.log('🧹 Cleaning up Yjs resources');
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
  }, [noteId, user, editorRef.current]);

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