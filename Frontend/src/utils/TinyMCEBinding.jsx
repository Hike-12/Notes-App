export class TinyMCEBinding {
  constructor(ytext, editor, awareness) {
    this.ytext = ytext;
    this.editor = editor;
    this.awareness = awareness;
    this.isSyncing = false;
    this.isInitialized = false;
    this.lastContent = '';
    
    // Initialize
    this.init();
  }
  
  init() {
    // Initial content sync
    const initialContent = this.ytext.toString();
    if (initialContent && !this.editor.getContent()) {
      this.isSyncing = true;
      this.editor.setContent(initialContent);
      this.lastContent = initialContent;
      this.isSyncing = false;
    }
    
    this.isInitialized = true;
    
    // Debounced content update with diff-based approach
    let updateTimeout;
    const debouncedUpdate = (newContent) => {
      clearTimeout(updateTimeout);
      updateTimeout = setTimeout(() => {
        if (!this.isSyncing && this.isInitialized) {
          this.applyDiffToYjs(newContent);
        }
      }, 100); // Reduced debounce time for better responsiveness
    };
    
    // Listen for TinyMCE changes
    this.editor.on('input', () => {
      if (!this.isSyncing && this.isInitialized) {
        const content = this.editor.getContent();
        debouncedUpdate(content);
      }
    });
    
    // Listen for Yjs changes
    this.ytext.observe(event => {
      if (!this.isSyncing && this.isInitialized) {
        this.applyYjsChanges(event);
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
      }, 200);
    });
    
    // Awareness updates (even less frequent)
    let awarenessTimeout;
    this.awareness.on('change', () => {
      clearTimeout(awarenessTimeout);
      awarenessTimeout = setTimeout(() => {
        if (!this.isSyncing) {
          this.renderRemoteCursors();
        }
      }, 500);
    });
  }
  
  // Apply changes using character-level diff to prevent duplication
  applyDiffToYjs(newContent) {
    this.isSyncing = true;
    
    try {
      const oldContent = this.ytext.toString();
      
      // If content is completely different, replace all
      if (this.contentDifferenceRatio(oldContent, newContent) > 0.7) {
        this.ytext.delete(0, this.ytext.length);
        this.ytext.insert(0, newContent);
      } else {
        // Apply character-level diff
        const diff = this.calculateDiff(oldContent, newContent);
        this.applyDiffOperations(diff);
      }
      
      this.lastContent = newContent;
      this.updateCursorPosition();
    } catch (error) {
      console.warn('Error applying diff to Yjs:', error);
      // Fallback: replace all content
      this.ytext.delete(0, this.ytext.length);
      this.ytext.insert(0, newContent);
    }
    
    this.isSyncing = false;
  }
  
  // Apply Yjs changes to TinyMCE without losing cursor position
  applyYjsChanges(event) {
    this.isSyncing = true;
    
    try {
      const newContent = this.ytext.toString();
      const currentContent = this.editor.getContent();
      
      // Only update if content actually changed
      if (newContent !== currentContent && newContent !== this.lastContent) {
        // Save cursor position
        const selection = this.editor.selection;
        const bookmark = selection ? selection.getBookmark(2) : null;
        
        // Update content
        this.editor.setContent(newContent);
        
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
        
        this.lastContent = newContent;
      }
    } catch (error) {
      console.warn('Error applying Yjs changes:', error);
    }
    
    this.isSyncing = false;
  }
  
  // Calculate difference ratio between two strings
  contentDifferenceRatio(str1, str2) {
    const maxLength = Math.max(str1.length, str2.length);
    if (maxLength === 0) return 0;
    
    let differences = 0;
    for (let i = 0; i < maxLength; i++) {
      if (str1[i] !== str2[i]) differences++;
    }
    
    return differences / maxLength;
  }
  
  // Simple character-level diff calculation
  calculateDiff(oldStr, newStr) {
    const operations = [];
    let oldIndex = 0;
    let newIndex = 0;
    
    while (oldIndex < oldStr.length || newIndex < newStr.length) {
      if (oldIndex >= oldStr.length) {
        // Insert remaining characters
        operations.push({
          type: 'insert',
          position: oldIndex,
          content: newStr.slice(newIndex)
        });
        break;
      } else if (newIndex >= newStr.length) {
        // Delete remaining characters
        operations.push({
          type: 'delete',
          position: oldIndex,
          length: oldStr.length - oldIndex
        });
        break;
      } else if (oldStr[oldIndex] === newStr[newIndex]) {
        // Characters match, move forward
        oldIndex++;
        newIndex++;
      } else {
        // Find next matching character
        let foundMatch = false;
        
        // Look ahead for insertions
        for (let i = newIndex + 1; i < Math.min(newIndex + 10, newStr.length); i++) {
          if (newStr[i] === oldStr[oldIndex]) {
            operations.push({
              type: 'insert',
              position: oldIndex,
              content: newStr.slice(newIndex, i)
            });
            newIndex = i;
            foundMatch = true;
            break;
          }
        }
        
        if (!foundMatch) {
          // Look ahead for deletions
          for (let i = oldIndex + 1; i < Math.min(oldIndex + 10, oldStr.length); i++) {
            if (oldStr[i] === newStr[newIndex]) {
              operations.push({
                type: 'delete',
                position: oldIndex,
                length: i - oldIndex
              });
              oldIndex = i;
              foundMatch = true;
              break;
            }
          }
        }
        
        if (!foundMatch) {
          // Replace character
          operations.push({
            type: 'replace',
            position: oldIndex,
            oldChar: oldStr[oldIndex],
            newChar: newStr[newIndex]
          });
          oldIndex++;
          newIndex++;
        }
      }
    }
    
    return operations;
  }
  
  // Apply diff operations to Yjs text
  applyDiffOperations(operations) {
    // Apply operations in reverse order to maintain correct positions
    for (let i = operations.length - 1; i >= 0; i--) {
      const op = operations[i];
      
      switch (op.type) {
        case 'insert':
          this.ytext.insert(op.position, op.content);
          break;
        case 'delete':
          this.ytext.delete(op.position, op.length);
          break;
        case 'replace':
          this.ytext.delete(op.position, 1);
          this.ytext.insert(op.position, op.newChar);
          break;
      }
    }
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
        if (Date.now() - (state.cursor.timestamp || 0) > 5000) return;
        
        // Create cursor element
        const cursorElement = this.editor.getDoc().createElement('div');
        cursorElement.className = 'remote-caret';
        cursorElement.style.cssText = `
          position: absolute;
          height: 1.2em;
          border-left: 2px solid ${state.user.color};
          pointer-events: none;
          z-index: 1000;
          left: ${Math.min(state.cursor.anchor * 8, 500)}px;
          transition: left 0.2s ease;
        `;
        
        const labelElement = this.editor.getDoc().createElement('div');
        labelElement.textContent = state.user.name;
        labelElement.style.cssText = `
          background-color: ${state.user.color};
          color: white;
          padding: 1px 4px;
          border-radius: 2px;
          font-size: 10px;
          white-space: nowrap;
          margin-top: -18px;
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