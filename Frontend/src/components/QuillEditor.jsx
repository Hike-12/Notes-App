import React, { useRef, useEffect, useState } from 'react';
import Quill from 'quill';
import 'quill/dist/quill.snow.css';

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

    // Quill configuration
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
          ['link', 'blockquote', 'code-block'],
          ['clean']
        ],
        history: {
          delay: 1000,
          maxStack: 50,
          userOnly: false
        }
      },
      formats: [
        'header', 'font', 'size',
        'bold', 'italic', 'underline', 'strike', 'blockquote',
        'list', 'bullet', 'indent',
        'link', 'image', 'color', 'background',
        'align', 'code-block'
      ]
    });

    quillRef.current = quill;
    setIsReady(true);

    // Set initial content
    if (value && !quill.getText().trim()) {
      quill.setContents(quill.clipboard.convert(value));
    }

    // Listen for text changes
    const handleTextChange = (delta, oldDelta, source) => {
      if (source === 'user' && onChange) {
        const html = quill.root.innerHTML;
        onChange(html);
      }
    };

    quill.on('text-change', handleTextChange);

    // Call onInit callback
    if (onInit) {
      onInit(quill);
    }

    return () => {
      if (quillRef.current) {
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
        
        /* Cursor styles for collaboration */
        .ql-cursor {
          position: absolute;
          border-left: 2px solid;
          margin-left: -1px;
          pointer-events: none;
        }
        
        .ql-cursor-flag {
          position: absolute;
          top: -2px;
          left: -2px;
          font-size: 12px;
          font-weight: bold;
          color: white;
          padding: 2px 6px;
          border-radius: 3px;
          white-space: nowrap;
          pointer-events: none;
        }
        
        @media (max-width: 768px) {
          .quill-wrapper .ql-editor {
            padding: 12px;
            font-size: 16px;
          }
          
          .quill-wrapper .ql-toolbar {
            padding: 6px 8px;
          }
        }
      `}</style>
    </div>
  );
};

export default QuillEditor;