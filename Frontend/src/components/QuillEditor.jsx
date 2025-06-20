// Update the imports at the top
import React, { useRef, useEffect, useState } from 'react';
import Quill from 'quill';
import QuillCursors from 'quill-cursors';
import 'quill/dist/quill.snow.css';

// Register the cursors module BEFORE the component
Quill.register('modules/cursors', QuillCursors);

const QuillEditor = ({ 
  value, 
  onChange, 
  onInit, 
  readOnly = false, 
  placeholder = 'Start writing...',
  className = '' 
}) => {
  const editorRef = useRef(null);
  const quillRef = useRef(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!editorRef.current) return;

    // Enhanced Quill configuration with working links
    const quill = new Quill(editorRef.current, {
      theme: 'snow',
      readOnly: readOnly,
      placeholder: placeholder,
      modules: {
        toolbar: readOnly ? false : [
          [{ 'header': [1, 2, 3, false] }],
          ['bold', 'italic', 'underline', 'strike'],
          [{ 'color': [] }, { 'background': [] }],
          [{ 'list': 'ordered'}, { 'list': 'bullet' }],
          [{ 'align': [] }],
          ['link', 'blockquote', 'code-block'], // Link is here
          ['clean']
        ],
        history: {
          delay: 500, // Reduced for better collaboration
          maxStack: 30,
          userOnly: false
        },
        // Add cursors module for collaboration
        cursors: {
          transformOnTextChange: true,
          autoRegisterListener: false,
        }
      },
      formats: [
        'header', 'font', 'size',
        'bold', 'italic', 'underline', 'strike', 'blockquote',
        'list', 'bullet', 'indent',
        'link', 'image', 'color', 'background', // Make sure 'link' is in formats
        'align', 'code-block'
      ]
    });

    quillRef.current = quill;
    setIsReady(true);

    // Set initial content
    if (value && !quill.getText().trim()) {
      try {
        quill.setContents(quill.clipboard.convert(value));
      } catch (error) {
        console.warn('Error setting initial content:', error);
        quill.setText(value.replace(/<[^>]*>/g, ''));
      }
    }

    // Enhanced text change handler
    let changeTimeout;
    const handleTextChange = (delta, oldDelta, source) => {
      if (source === 'user' && onChange) {
        clearTimeout(changeTimeout);
        changeTimeout = setTimeout(() => {
          const html = quill.root.innerHTML;
          onChange(html);
        }, 100);
      }
    };

    quill.on('text-change', handleTextChange);

    // Add custom link handler for better UX
    const toolbar = quill.getModule('toolbar');
    if (toolbar) {
      toolbar.addHandler('link', function(value) {
        if (value) {
          const href = prompt('Enter the URL:');
          if (href) {
            // Validate and format URL
            let formattedHref = href;
            if (!href.startsWith('http://') && !href.startsWith('https://')) {
              formattedHref = 'https://' + href;
            }
            this.quill.format('link', formattedHref);
          }
        } else {
          this.quill.format('link', false);
        }
      });
    }

    // Call onInit callback
    if (onInit) {
      onInit(quill);
    }

    console.log('📝 Quill editor initialized with links and cursors');

    return () => {
      clearTimeout(changeTimeout);
      if (quillRef.current) {
        try {
          quillRef.current.off('text-change', handleTextChange);
        } catch (error) {
          console.warn('Error cleaning up Quill:', error);
        }
        quillRef.current = null;
      }
    };
  }, [readOnly]);

  // Update readOnly state
  useEffect(() => {
    if (quillRef.current) {
      quillRef.current.enable(!readOnly);
    }
  }, [readOnly]);

  return (
    <div className={`quill-wrapper ${className}`}>
      <div 
        ref={editorRef} 
        style={{ 
          height: '100%', 
          border: 'none',
          fontSize: '16px',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
        }} 
      />
      <style jsx>{`
        .quill-wrapper {
          height: 100%;
          display: flex;
          flex-direction: column;
        }
        
        .quill-wrapper .ql-container {
          flex: 1;
          border: none !important;
          font-size: 16px;
        }
        
        .quill-wrapper .ql-toolbar {
          border: none !important;
          border-bottom: 1px solid #e1e5e9 !important;
          padding: 8px 12px;
          flex-shrink: 0;
        }
        
        .quill-wrapper .ql-editor {
          padding: 20px;
          line-height: 1.6;
          color: #3B3B1A;
        }
        
        .quill-wrapper .ql-editor.ql-blank::before {
          color: #999;
          font-style: italic;
        }
        
        /* Link styles */
        .quill-wrapper .ql-editor a {
          color: #0066cc;
          text-decoration: underline;
          cursor: pointer;
        }
        
        .quill-wrapper .ql-editor a:hover {
          color: #0052a3;
          text-decoration: none;
        }
        
        /* Toolbar link button styling */
        .quill-wrapper .ql-toolbar .ql-link {
          color: #444;
        }
        
        .quill-wrapper .ql-toolbar .ql-link.ql-active {
          color: #06c;
        }
        
        /* Enhanced cursor styles for collaboration */
        .ql-cursor {
          position: absolute;
          border-left: 2px solid;
          margin-left: -1px;
          pointer-events: none;
          z-index: 1000;
          height: 1.2em;
          animation: cursorPulse 1.5s infinite;
        }
        
        .ql-cursor-flag {
          position: absolute;
          top: -20px;
          left: -2px;
          font-size: 11px;
          font-weight: 600;
          color: white !important;
          padding: 3px 7px;
          border-radius: 4px;
          white-space: nowrap;
          pointer-events: none;
          z-index: 1001;
          box-shadow: 0 2px 8px rgba(0,0,0,0.2);
          max-width: 120px;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        
        .ql-cursor-caret {
          height: 1.2em;
          animation: cursorBlink 1s infinite;
        }
        
        .ql-cursor-selections {
          background-color: rgba(0, 0, 0, 0.08);
          border-radius: 2px;
          opacity: 0.3;
        }
        
        @keyframes cursorBlink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0.4; }
        }
        
        @keyframes cursorPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
        
        /* Remote selection highlighting */
        .ql-cursor-selection-block {
          background-color: rgba(0, 0, 0, 0.08);
          border-radius: 2px;
        }
        
        @media (max-width: 768px) {
          .quill-wrapper .ql-editor {
            padding: 12px;
            font-size: 16px;
          }
          
          .quill-wrapper .ql-toolbar {
            padding: 6px 8px;
          }
          
          .ql-cursor-flag {
            font-size: 10px;
            padding: 2px 5px;
            top: -18px;
            max-width: 80px;
          }
        }
      `}</style>
    </div>
  );
};

export default QuillEditor;