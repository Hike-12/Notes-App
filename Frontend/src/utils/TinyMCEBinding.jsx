export class TinyMCEBinding {
  constructor(ytext, editor, awareness) {
    this.ytext = ytext;
    this.editor = editor;
    this.awareness = awareness;
    this.isSyncing = false;
    this.isInitialized = false;
    
    // Initialize
    this.init();
  }
  
  init() {
    // Initial content sync - only if editor is empty
    if (!this.editor.getContent() && this.ytext.toString()) {
      this.isSyncing = true;
      this.editor.setContent(this.ytext.toString());
      this.isSyncing = false;
    }
    
    this.isInitialized = true;
    
    // Debounced content update function
    let updateTimeout;
    const debouncedUpdate = (content) => {
      clearTimeout(updateTimeout);
      updateTimeout = setTimeout(() => {
        if (!this.isSyncing && this.isInitialized) {
          this.isSyncing = true;
          
          // Only update if content actually changed
          const currentYText = this.ytext.toString();
          if (currentYText !== content) {
            this.ytext.delete(0, this.ytext.length);
            this.ytext.insert(0, content);
          }
          
          this.updateCursorPosition();
          this.isSyncing = false;
        }
      }, 150); // 150ms debounce
    };
    
    // Listen for TinyMCE changes with debouncing
    this.editor.on('input', () => {
      if (!this.isSyncing && this.isInitialized) {
        const content = this.editor.getContent();
        debouncedUpdate(content);
      }
    });
    
    // Listen for cursor/selection changes (less frequent updates)
    let cursorTimeout;
    this.editor.on('SelectionChange', () => {
      clearTimeout(cursorTimeout);
      cursorTimeout = setTimeout(() => {
        if (!this.isSyncing) {
          this.updateCursorPosition();
        }
      }, 300);
    });
    
    // Listen for Yjs changes
    this.ytext.observe(event => {
      if (!this.isSyncing && this.isInitialized) {
        this.isSyncing = true;
        
        const newContent = this.ytext.toString();
        const currentContent = this.editor.getContent();
        
        // Only update if content is different
        if (newContent !== currentContent) {
          // Preserve cursor position
          const bookmark = this.editor.selection.getBookmark(2);
          this.editor.setContent(newContent);
          this.editor.selection.moveToBookmark(bookmark);
        }
        
        this.isSyncing = false;
      }
    });
    
    // Listen for awareness updates (less frequent)
    let awarenessTimeout;
    this.awareness.on('change', () => {
      clearTimeout(awarenessTimeout);
      awarenessTimeout = setTimeout(() => {
        this.renderRemoteCursors();
      }, 200);
    });
  }
  
  updateCursorPosition() {
    if (!this.awareness || this.isSyncing) return;
    
    try {
      const selection = this.editor.selection;
      if (!selection) return;
      
      const range = selection.getRng();
      const cursorInfo = {
        anchor: range.startOffset,
        head: range.endOffset,
        timestamp: Date.now()
      };
      
      this.awareness.setLocalStateField('cursor', cursorInfo);
    } catch (error) {
      console.warn('Cursor update error:', error);
    }
  }
  
  renderRemoteCursors() {
    if (this.isSyncing) return;
    
    try {
      // Remove existing cursors
      const existingCursors = this.editor.getDoc().querySelectorAll('.remote-caret');
      existingCursors.forEach(cursor => cursor.remove());
      
      const states = this.awareness.getStates();
      const currentUser = this.awareness.getLocalState()?.user?.id;
      
      states.forEach((state, clientId) => {
        if (!state.user || !state.cursor || state.user.id === currentUser) return;
        
        // Skip old cursor positions (older than 5 seconds)
        if (Date.now() - (state.cursor.timestamp || 0) > 5000) return;
        
        // Create and position cursor (simplified positioning)
        const cursorElement = this.editor.getDoc().createElement('div');
        cursorElement.className = 'remote-caret';
        cursorElement.style.cssText = `
          position: absolute;
          height: 1.2em;
          border-left: 2px solid ${state.user.color};
          pointer-events: none;
          z-index: 1000;
          left: ${Math.min(state.cursor.anchor * 8, 500)}px;
          animation: blink 1s infinite;
        `;
        
        const labelElement = this.editor.getDoc().createElement('div');
        labelElement.textContent = state.user.name;
        labelElement.style.cssText = `
          background-color: ${state.user.color};
          color: white;
          padding: 2px 6px;
          border-radius: 3px;
          font-size: 11px;
          white-space: nowrap;
          margin-top: -20px;
        `;
        
        cursorElement.appendChild(labelElement);
        this.editor.getBody().appendChild(cursorElement);
      });
    } catch (error) {
      console.warn('Cursor rendering error:', error);
    }
  }
  
  destroy() {
    this.isInitialized = false;
    this.editor.off('input');
    this.editor.off('SelectionChange');
    this.awareness.off('change');
    
    // Remove all remote cursors
    const existingCursors = this.editor.getDoc().querySelectorAll('.remote-caret');
    existingCursors.forEach(cursor => cursor.remove());
  }
}