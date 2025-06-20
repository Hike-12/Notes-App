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
    if (oldContent !== newTextContent) {
      // Character-level diff
      const ops = this.getDiffOps(oldContent, newTextContent);
      // Apply in reverse so offsets remain valid
      for (let i = ops.length - 1; i >= 0; i--) {
        const op = ops[i];
        if (op.type === 'insert') {
          this.ytext.insert(op.pos, op.text);
        } else if (op.type === 'delete') {
          this.ytext.delete(op.pos, op.count);
        }
      }
      this.lastContent = newTextContent;
    }
    this.updateCursorPosition();
  } catch (error) {
    console.warn('Error applying text to Yjs:', error);
  }
  this.isSyncing = false;
}

applyYjsChangesToEditor() {
  this.isSyncing = true;
  try {
    const newTextContent = this.ytext.toString();
    const currentText = this.editor.getContent({ format: 'text' });
    
    // Only update if text actually changed
    if (newTextContent !== currentText && newTextContent !== this.lastContent) {
      const bookmark = this.editor.selection?.getBookmark(2) || null;
      const formattedHTML = this.convertTextToHTML(newTextContent);
      this.editor.setContent(formattedHTML);
      if (bookmark) {
        try {
          this.editor.selection.moveToBookmark(bookmark);
        } catch {
          // If restoring fails, place cursor at end
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

// Simple character-level diff
getDiffOps(oldStr, newStr) {
  const ops = [];
  let iOld = 0, iNew = 0;
  while (iOld < oldStr.length || iNew < newStr.length) {
    // Same character
    if (oldStr[iOld] === newStr[iNew]) {
      iOld++;
      iNew++;
      continue;
    }
    // If we've reached the end of oldStr, insert what's left of newStr
    if (iOld >= oldStr.length) {
      ops.push({ type: 'insert', pos: iOld, text: newStr.slice(iNew) });
      break;
    }
    // If we've reached the end of newStr, delete what's left of oldStr
    if (iNew >= newStr.length) {
      ops.push({ type: 'delete', pos: iOld, count: oldStr.length - iOld });
      break;
    }
    // Characters differ
    ops.push({ type: 'delete', pos: iOld, count: 1 });
    ops.push({ type: 'insert', pos: iOld, text: newStr[iNew] });
    iOld++;
    iNew++;
  }
  return ops;
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