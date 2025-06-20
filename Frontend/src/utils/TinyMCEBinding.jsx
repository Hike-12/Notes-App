export class TinyMCEBinding {
  constructor(ytext, editor, awareness) {
    this.ytext = ytext;
    this.editor = editor;
    this.awareness = awareness;
    this.isSyncing = false;
    this.isInitialized = false;
    this.lastContent = '';
    
    // Initialize WITHOUT setting initial content
    this.init();
  }
  
  init() {
    // DO NOT sync initial content - let TinyMCE handle its own content
    this.isInitialized = true;
    
    // Debounced content update with plain text handling
    let updateTimeout;
    const debouncedUpdate = (newContent) => {
      clearTimeout(updateTimeout);
      updateTimeout = setTimeout(() => {
        if (!this.isSyncing && this.isInitialized) {
          this.applyTextToYjs(newContent);
        }
      }, 150);
    };
    
    // Listen for TinyMCE changes - convert HTML to plain text
    this.editor.on('input', () => {
      if (!this.isSyncing && this.isInitialized) {
        // Get plain text content instead of HTML
        const plainTextContent = this.editor.getContent({ format: 'text' });
        debouncedUpdate(plainTextContent);
      }
    });
    
    // Listen for Yjs changes - apply as plain text
    this.ytext.observe(event => {
      if (!this.isSyncing && this.isInitialized) {
        this.applyYjsChangesToEditor(event);
      }
    });
    
    // Cursor tracking (less frequent)
    let cursorTimeout;
    this.editor.on('SelectionChange', () => {
      clearTimeout(cursorTimeout);
      cursorTimeout = setTimeout(() => {
        if (!this.isSyncing) {
          this.updateCursorPosition();
        }
      }, 300);
    });
    
    // Awareness updates (even less frequent)
    let awarenessTimeout;
    this.awareness.on('change', () => {
      clearTimeout(awarenessTimeout);
      awarenessTimeout = setTimeout(() => {
        if (!this.isSyncing) {
          this.renderRemoteCursors();
        }
      }, 1000);
    });
  }
  
  // Apply plain text to Yjs (no HTML)
  applyTextToYjs(newTextContent) {
    this.isSyncing = true;
    
    try {
      const oldContent = this.ytext.toString();
      
      // Only update if content actually changed
      if (oldContent !== newTextContent) {
        // Simple replacement to avoid complex diff issues
        this.ytext.delete(0, this.ytext.length);
        if (newTextContent) {
          this.ytext.insert(0, newTextContent);
        }
        
        this.lastContent = newTextContent;
      }
      
      this.updateCursorPosition();
    } catch (error) {
      console.warn('Error applying text to Yjs:', error);
    }
    
    this.isSyncing = false;
  }
  
  // Apply Yjs changes to TinyMCE as formatted text
  applyYjsChangesToEditor(event) {
    this.isSyncing = true;
    
    try {
      const newTextContent = this.ytext.toString();
      const currentPlainText = this.editor.getContent({ format: 'text' });
      
      // Only update if content actually changed
      if (newTextContent !== currentPlainText && newTextContent !== this.lastContent) {
        // Save cursor position
        const selection = this.editor.selection;
        const bookmark = selection ? selection.getBookmark(2) : null;
        
        // Convert plain text to basic HTML paragraphs
        const formattedContent = this.convertTextToHTML(newTextContent);
        
        // Update content
        this.editor.setContent(formattedContent);
        
        // Restore cursor position if possible
        if (bookmark && selection) {
          try {
            selection.moveToBookmark(bookmark);
          } catch (e) {
            // If bookmark restoration fails, place cursor at end
            this.editor.selection.select(this.editor.getBody(), true);
            this.editor.selection.collapse(false);
          }
        }
        
        this.lastContent = newTextContent;
      }
    } catch (error) {
      console.warn('Error applying Yjs changes:', error);
    }
    
    this.isSyncing = false;
  }
  
  // Convert plain text to basic HTML
  convertTextToHTML(plainText) {
    if (!plainText) return '<p></p>';
    
    // Split by newlines and wrap each line in a paragraph
    const lines = plainText.split('\n');
    const htmlLines = lines.map(line => {
      const trimmedLine = line.trim();
      return trimmedLine ? `<p>${this.escapeHtml(trimmedLine)}</p>` : '<p></p>';
    });
    
    return htmlLines.join('');
  }
  
  // Escape HTML characters
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
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
      // Silently handle cursor errors
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
        
        // Skip old cursor positions
        if (Date.now() - (state.cursor.timestamp || 0) > 10000) return;
        
        // Create cursor element
        const cursorElement = this.editor.getDoc().createElement('div');
        cursorElement.className = 'remote-caret';
        cursorElement.style.cssText = `
          position: absolute;
          height: 1.2em;
          border-left: 2px solid ${state.user.color};
          pointer-events: none;
          z-index: 1000;
          left: ${Math.min(state.cursor.anchor * 10, 400)}px;
          transition: left 0.3s ease;
        `;
        
        const labelElement = this.editor.getDoc().createElement('div');
        labelElement.textContent = state.user.name;
        labelElement.style.cssText = `
          background-color: ${state.user.color};
          color: white;
          padding: 2px 6px;
          border-radius: 3px;
          font-size: 10px;
          white-space: nowrap;
          margin-top: -20px;
          opacity: 0.9;
        `;
        
        cursorElement.appendChild(labelElement);
        this.editor.getBody().appendChild(cursorElement);
      });
    } catch (error) {
      // Silently handle cursor rendering errors
    }
  }
  
  destroy() {
    this.isInitialized = false;
    this.editor.off('input');
    this.editor.off('SelectionChange');
    this.awareness.off('change');
    
    const existingCursors = this.editor.getDoc().querySelectorAll('.remote-caret');
    existingCursors.forEach(cursor => cursor.remove());
  }
}