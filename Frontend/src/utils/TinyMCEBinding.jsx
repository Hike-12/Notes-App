import * as Y from 'yjs';

export class TinyMCEBinding {
  constructor(ytext, editor, awareness) {
    this.ytext = ytext;
    this.editor = editor;
    this.awareness = awareness;
    this.isSyncing = false;
    
    // Initialize
    this.init();
  }
  
  init() {
    // Initial content sync
    this.editor.setContent(this.ytext.toString());
    
    // Listen for TinyMCE changes
    this.editor.on('change input', () => {
      if (!this.isSyncing) {
        this.isSyncing = true;
        const content = this.editor.getContent();
        
        // Apply changes to Yjs document
        this.ytext.delete(0, this.ytext.length);
        this.ytext.insert(0, content);
        
        // Update cursor position
        this.updateCursorPosition();
        
        this.isSyncing = false;
      }
    });
    
    // Listen for cursor/selection changes
    this.editor.on('SelectionChange', () => {
      this.updateCursorPosition();
    });
    
    // Listen for Yjs changes
    this.ytext.observe(event => {
      if (!this.isSyncing) {
        this.isSyncing = true;
        
        // Apply Yjs changes to editor
        this.editor.setContent(this.ytext.toString());
        
        this.isSyncing = false;
      }
    });
    
    // Listen for awareness updates
    this.awareness.on('change', () => {
      this.renderRemoteCursors();
    });
  }
  
  updateCursorPosition() {
    if (!this.awareness) return;
    
    const selection = this.editor.selection;
    if (!selection) return;
    
    // Get cursor position
    const range = selection.getRng();
    const cursorInfo = {
      anchor: range.startOffset,
      head: range.endOffset,
      from: { line: 0, ch: range.startOffset },
      to: { line: 0, ch: range.endOffset }
    };
    
    // Update awareness state
    this.awareness.setLocalStateField('cursor', cursorInfo);
  }
  
  renderRemoteCursors() {
    // Remove existing cursors
    const existingCursors = this.editor.getDoc().querySelectorAll('.remote-caret');
    existingCursors.forEach(cursor => cursor.remove());
    
    // Get states from awareness
    const states = this.awareness.getStates();
    
    // Current user ID
    const currentUser = this.awareness.getLocalState().user.id;
    
    // Render each remote cursor
    states.forEach((state, clientId) => {
      // Skip if no user data or cursor data
      if (!state.user || !state.cursor) return;
      
      // Skip current user
      if (state.user.id === currentUser) return;
      
      try {
        // Create cursor element
        const cursorElement = this.editor.getDoc().createElement('div');
        cursorElement.className = 'remote-caret';
        cursorElement.style.height = '1.2em';
        cursorElement.style.borderLeft = `2px solid ${state.user.color}`;
        cursorElement.style.position = 'absolute';
        
        // Create user label
        const labelElement = this.editor.getDoc().createElement('div');
        labelElement.textContent = state.user.name;
        labelElement.style.backgroundColor = state.user.color;
        labelElement.style.color = 'white';
        labelElement.style.padding = '2px 6px';
        labelElement.style.borderRadius = '3px';
        labelElement.style.fontSize = '12px';
        
        cursorElement.appendChild(labelElement);
        
        // Position cursor (basic positioning)
        // This is simplified - real implementation would need better positioning
        const container = this.editor.getBody();
        cursorElement.style.left = `${state.cursor.anchor * 8}px`; // Approximate positioning
        
        container.appendChild(cursorElement);
      } catch (error) {
        console.error('Error rendering remote cursor:', error);
      }
    });
  }
  
  destroy() {
    // Clean up
    this.editor.off('change input');
    this.editor.off('SelectionChange');
    this.awareness.off('change');
    
    // Remove all remote cursors
    const existingCursors = this.editor.getDoc().querySelectorAll('.remote-caret');
    existingCursors.forEach(cursor => cursor.remove());
  }
}