import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Editor } from '@tinymce/tinymce-react';
import { useWebSocket } from '../hooks/useWebSocket.jsx';
import ShareModal from './ShareModal.jsx';

// Utility functions remain the same...
const extractTitle = (htmlContent) => {
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = htmlContent;
  const firstParagraph = tempDiv.querySelector('p');
  return firstParagraph ? firstParagraph.innerText : '';
};

const removeTitleFromContent = (htmlContent) => {
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = htmlContent;
  const firstParagraph = tempDiv.querySelector('p');
  if (firstParagraph) {
    firstParagraph.remove();
  }
  return tempDiv.innerHTML;
};

export default function TextEditor({ setSidebarOpen }) {
  // All your existing state...
  const { id } = useParams();
  const navigate = useNavigate();
  const editorRef = useRef(null);
  const isUpdatingFromWS = useRef(false);
  const currentUserId = useRef(`user_${Math.random().toString(36).substr(2, 9)}`);
  const cursorsContainerRef = useRef(null); // Add this for cursor positioning

  const [content, setContent] = useState('');
  const [isNewNote, setIsNewNote] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [foundNote, setFoundNote] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [collaborators, setCollaborators] = useState([]);
  const [cursors, setCursors] = useState({});
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [permission, setPermission] = useState('edit');
  const [isOwner, setIsOwner] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  // Enhanced WebSocket with better cursor handling
  const { isConnected, sendContentChange, sendCursorPosition } = useWebSocket(
    id,
    (newContent, userId) => {
      if (userId !== currentUserId.current && editorRef.current) {
        isUpdatingFromWS.current = true;
        editorRef.current.setContent(newContent);
        setContent(newContent);
        setTimeout(() => {
          isUpdatingFromWS.current = false;
        }, 100);
      }
    },
    (collaboratorsList) => {
      setCollaborators(collaboratorsList);
    },
    (position, userId, userName, color) => {
      if (userId !== currentUserId.current) {
        setCursors(prev => ({
          ...prev,
          [userId]: { 
            position, 
            userName, 
            color,
            timestamp: Date.now() // Add timestamp for cleanup
          }
        }));
        
        // Clean up old cursors after 10 seconds of inactivity
        setTimeout(() => {
          setCursors(prev => {
            const updated = { ...prev };
            if (updated[userId] && Date.now() - updated[userId].timestamp > 10000) {
              delete updated[userId];
            }
            return updated;
          });
        }, 10000);
      }
    }
  );

  // All your existing useEffect and handlers remain the same...
  useEffect(() => {
    setLoading(true);
    setError(null);
    const fetchData = async () => {
      if (id) {
        try {
          const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/get-note/${id}/`, {
            credentials: 'include'
          });          
          
          if (!response.ok) {
            if (response.status === 401) {
              navigate('/');
              return;
            }
            if (response.status === 403) {
              setError('You do not have permission to access this note');
              return;
            }
            throw new Error('Network response was not ok');
          }

          const data = await response.json();

          if (data) {
            setContent(data.body || ''); 
            setFoundNote(data);
            setIsNewNote(false);
            setCollaborators(data.collaborators || []);
            setPermission(data.permission || 'edit');
            setIsOwner(data.is_owner || false);
          } else {
            setError('Note not found');
          }
        } catch (error) {
          setError('There was an error fetching the note!');
          console.error('Error:', error);
        } finally {
          setLoading(false);
        }
      } else {
        setContent('');
        setIsNewNote(true);
        setPermission('edit');
        setIsOwner(true);
        setLoading(false);
      }
    };

    fetchData();
  }, [id, navigate]);

  const handleEditorChange = (newContent) => {
    if (permission !== 'edit') {
      return;
    }
    
    if (!isUpdatingFromWS.current) {
      setContent(newContent);
      if (id && isConnected) {
        sendContentChange(newContent, currentUserId.current);
      }
    }
  };

  // ENHANCED CURSOR HANDLING
  const handleCursorChange = (editor) => {
    if (!isUpdatingFromWS.current && id && isConnected) {
      try {
        const selection = editor.selection;
        const range = selection.getRng();
        
        // Get more precise cursor position
        const bookmark = selection.getBookmark(2, true);
        const cursorInfo = {
          bookmark: bookmark,
          startOffset: range.startOffset,
          endOffset: range.endOffset,
          collapsed: range.collapsed
        };
        
        // Get collaborator info
        const collaborator = collaborators.find(c => c.user_identifier === currentUserId.current);
        const userName = collaborator?.user_name || `User${currentUserId.current.slice(-5)}`;
        const color = collaborator?.color || '#FF6B6B';
        
        sendCursorPosition(
          cursorInfo, 
          currentUserId.current, 
          userName,
          color
        );
      } catch (error) {
        console.log('Cursor tracking error:', error);
      }
    }
  };

  // VISUAL CURSOR RENDERING
  const renderOtherCursors = () => {
    if (!editorRef.current) return null;
    
    return Object.entries(cursors).map(([userId, cursorData]) => {
      try {
        const editor = editorRef.current;
        const doc = editor.getDoc();
        
        // Try to restore cursor position using bookmark
        if (cursorData.position?.bookmark) {
          const selection = editor.selection;
          selection.moveToBookmark(cursorData.position.bookmark);
          const range = selection.getRng();
          
          // Get the visual position
          const rect = range.getBoundingClientRect();
          const editorRect = editor.getContainer().getBoundingClientRect();
          
          if (rect.top > 0 && rect.left > 0) {
            return (
              <div key={userId} className="absolute pointer-events-none z-50">
                <div
                  className="absolute w-0.5 h-5 animate-pulse"
                  style={{
                    backgroundColor: cursorData.color,
                    left: rect.left - editorRect.left,
                    top: rect.top - editorRect.top + 20,
                  }}
                />
                <div
                  className="absolute px-2 py-1 text-xs text-white rounded-md shadow-lg whitespace-nowrap"
                  style={{
                    backgroundColor: cursorData.color,
                    left: rect.left - editorRect.left,
                    top: rect.top - editorRect.top - 5,
                  }}
                >
                  {cursorData.userName}
                </div>
              </div>
            );
          }
        }
      } catch (error) {
        console.log('Render cursor error:', error);
      }
      return null;
    });
  };

  // All your existing handlers (save, delete, share) remain the same...
  const handleDelete = () => {
    if (!foundNote || isNewNote) {
      console.warn('No note to delete or it is a new note.');
      return;
    }

    if (!isOwner) {
      alert('Only the note owner can delete this note.');
      return;
    }

    if (window.confirm('Are you sure you want to delete this note? This action cannot be undone.')) {
      fetch(`${import.meta.env.VITE_API_BASE_URL}/api/delete-note/${foundNote.id}/`, {
        method: 'DELETE',
        credentials: 'include'
      })
        .then(response => {
          if (response.ok) {
            navigate('/');
            window.location.reload(); 
          } else {
            console.error('Error deleting note');
          }
        })
        .catch(error => {
          console.error('There was an error deleting the note!', error);
        });
    }
  };

  const handleSave = () => {
    if (permission !== 'edit') {
      alert('You do not have permission to edit this note.');
      return;
    }

    setIsSaving(true);
    const title = extractTitle(content);
    const contentWithoutTitle = removeTitleFromContent(content);
    const fullContent = `<p>${title}</p>${contentWithoutTitle}`;

    fetch(`${import.meta.env.VITE_API_BASE_URL}/api/save-note/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        id: isNewNote ? null : foundNote.id,
        content: fullContent,
        title,
      }),
    })
      .then(response => response.json())
      .then(data => {
        setIsSaving(false);
        if (data.success) {
          setShowSuccess(true);
          
          if (isNewNote) {
            navigate(`/edit-note/${data.id}`, { replace: true });
            setTimeout(() => {
              window.location.reload();
            }, 1000);
          } else {
            console.log('Content saved:', data);
            setTimeout(() => {
              setShowSuccess(false);
            }, 2000);
          }
        } else {
          alert(data.message || 'Failed to save note');
        }
      })
      .catch(error => {
        console.error('There was an error saving the content!', error);
        setIsSaving(false);
      });
  };

  const handleShareUpdate = () => {
    if (id) {
      fetch(`${import.meta.env.VITE_API_BASE_URL}/api/get-note/${id}/`, {
        credentials: 'include'
      })
        .then(response => response.json())
        .then(data => {
          if (data) {
            setFoundNote(data);
          }
        })
        .catch(error => console.error('Error refreshing note:', error));
    }
  };

  // Loading and error states remain the same...
  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-[#E7EFC7] p-4">
        <div className="bg-white/40 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/20">
          <div className="flex items-center space-x-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#8A784E]"></div>
            <span className="text-[#3B3B1A] font-medium">Loading your note...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-[#E7EFC7] p-4">
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 shadow-lg max-w-md w-full text-center">
          <svg className="w-12 h-12 mx-auto text-red-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="text-lg font-semibold text-red-800 mb-2">Oops! Something went wrong</h3>
          <p className="text-red-600 mb-4">{error}</p>
          <button 
            onClick={() => navigate('/')}
            className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition-colors duration-200"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full bg-[#E7EFC7] flex flex-col">
      {/* Success notification */}
      {showSuccess && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg">
          <div className="flex items-center">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Note saved successfully!
          </div>
        </div>
      )}

      {/* Header - All your existing header code remains the same... */}
      <div className="bg-white/30 backdrop-blur-sm border-b border-white/20 p-4 flex-shrink-0 relative z-30">
        {/* Top row */}
        <div className="flex items-center justify-between mb-2">
          {/* Left: Menu + Title */}
          <div className="flex items-center space-x-3 min-w-0 flex-1">
            <button
              onClick={() => setSidebarOpen && setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg bg-white/40 hover:bg-white/60 transition-colors"
            >
              <svg className="w-5 h-5 text-[#8A784E]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            
            <button 
              onClick={() => navigate('/')}
              className="hidden lg:block p-2 rounded-lg bg-white/40 hover:bg-white/60 transition-colors"
            >
              <svg className="w-5 h-5 text-[#8A784E]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <h1 className="text-lg sm:text-xl font-bold text-[#3B3B1A] truncate">
              {isNewNote ? 'New Note' : foundNote?.title || 'Edit Note'}
            </h1>
          </div>

          {/* Right: Mobile menu button */}
          <button
            onClick={() => setShowMobileMenu(!showMobileMenu)}
            className="lg:hidden p-2 rounded-lg bg-white/40 hover:bg-white/60 transition-colors relative z-40"
          >
            <svg className="w-5 h-5 text-[#8A784E]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
            </svg>
          </button>
        </div>

        {/* Desktop status and buttons */}
        <div className="hidden lg:flex items-center justify-between">
          <div className="flex items-center space-x-2 text-sm text-[#8A784E]">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
            <span>•</span>
            <span>{collaborators.length} collaborators</span>
            
            {/* Active cursors indicator */}
            {Object.keys(cursors).length > 0 && (
              <>
                <span>•</span>
                <span className="text-blue-600 font-medium">
                  {Object.keys(cursors).length} active cursor{Object.keys(cursors).length !== 1 ? 's' : ''}
                </span>
              </>
            )}
            
            {!isNewNote && (
              <>
                <span>•</span>
                <span className={`px-2 py-1 rounded-full text-xs ${
                  permission === 'edit' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                }`}>
                  {permission === 'edit' ? 'Can Edit' : 'View Only'}
                </span>
              </>
            )}
          </div>

          <div className="flex items-center space-x-2">
            {!isNewNote && isOwner && (
              <button 
                onClick={() => setShareModalOpen(true)}
                className="bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-lg text-sm transition-colors"
              >
                Share
              </button>
            )}

            {permission === 'edit' && (
              <button 
                onClick={handleSave} 
                disabled={isSaving}
                className="bg-[#8A784E] hover:bg-[#3B3B1A] text-white py-2 px-4 rounded-lg text-sm transition-colors disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : 'Save'}
              </button>
            )}
            
            {!isNewNote && isOwner && (
              <button 
                onClick={handleDelete} 
                className="bg-red-500 hover:bg-red-600 text-white py-2 px-4 rounded-lg text-sm transition-colors"
              >
                Delete
              </button>
            )}
          </div>
        </div>

        {/* Mobile menu - same as before */}
        {showMobileMenu && (
          <div className="lg:hidden absolute top-full left-4 right-4 mt-2 p-3 bg-white/95 backdrop-blur-sm rounded-lg shadow-xl border border-white/30 z-50">
            <div className="flex items-center space-x-2 text-sm text-[#8A784E] mb-3">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
              <span>•</span>
              <span>{collaborators.length} collaborators</span>
              {Object.keys(cursors).length > 0 && (
                <>
                  <span>•</span>
                  <span className="text-blue-600">{Object.keys(cursors).length} cursors</span>
                </>
              )}
            </div>

            <div className="space-y-2">
              {!isNewNote && isOwner && (
                <button 
                  onClick={() => {
                    setShareModalOpen(true);
                    setShowMobileMenu(false);
                  }}
                  className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 px-3 rounded-lg text-sm transition-colors"
                >
                  Share Note
                </button>
              )}

              {permission === 'edit' && (
                <button 
                  onClick={() => {
                    handleSave();
                    setShowMobileMenu(false);
                  }} 
                  disabled={isSaving}
                  className="w-full bg-[#8A784E] hover:bg-[#3B3B1A] text-white py-2 px-3 rounded-lg text-sm disabled:opacity-50 transition-colors"
                >
                  {isSaving ? 'Saving...' : 'Save Note'}
                </button>
              )}
              
              {!isNewNote && isOwner && (
                <button 
                  onClick={() => {
                    handleDelete();
                    setShowMobileMenu(false);
                  }} 
                  className="w-full bg-red-500 hover:bg-red-600 text-white py-2 px-3 rounded-lg text-sm transition-colors"
                >
                  Delete Note
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Mobile menu overlay */}
      {showMobileMenu && (
        <div 
          className="fixed inset-0 bg-black/20 z-20 lg:hidden"
          onClick={() => setShowMobileMenu(false)}
        />
      )}

      {/* Editor Container with CURSOR OVERLAY */}
      <div className="flex-1 p-4 min-h-0 overflow-hidden relative">
        <div className="w-full h-full bg-white/40 backdrop-blur-sm rounded-xl shadow-lg border border-white/20 overflow-hidden relative">
          {/* Cursors overlay container */}
          <div ref={cursorsContainerRef} className="absolute inset-0 pointer-events-none z-40">
            {renderOtherCursors()}
          </div>

          <Editor
            apiKey={import.meta.env.VITE_TINYMCE_API_KEY}
            onInit={(evt, editor) => {
              editorRef.current = editor;
              editor.on('NodeChange', () => handleCursorChange(editor));
              editor.on('KeyUp', () => handleCursorChange(editor));
              editor.on('MouseUp', () => handleCursorChange(editor));
              editor.on('SelectionChange', () => handleCursorChange(editor));
            }}
            init={{
              height: '100%',
              width: '100%',
              // ALL TINYMCE PLUGINS
              plugins: [
                'advlist', 'autolink', 'lists', 'link', 'image', 'charmap', 'preview',
                'anchor', 'searchreplace', 'visualblocks', 'code', 'fullscreen',
                'insertdatetime', 'media', 'table', 'help', 'wordcount', 'emoticons',
                'template', 'paste', 'textcolor', 'colorpicker', 'textpattern',
                'codesample', 'hr', 'pagebreak', 'nonbreaking', 'save', 'autosave',
                'directionality', 'visualchars', 'quickbars', 'importcss'
              ],
              // FULL TOOLBAR WITH ALL FEATURES
              toolbar: permission === 'edit' 
                ? 'undo redo | blocks | ' +
                  'bold italic forecolor backcolor | alignleft aligncenter ' +
                  'alignright alignjustify | bullist numlist outdent indent | ' +
                  'removeformat | table tabledelete | tableprops tablerowprops tablecellprops | ' +
                  'tableinsertrowbefore tableinsertrowafter tabledeleterow | ' +
                  'tableinsertcolbefore tableinsertcolafter tabledeletecol | ' +
                  'link image media | codesample | emoticons charmap | ' +
                  'searchreplace | visualblocks fullscreen | ' +
                  'insertdatetime pagebreak | help'
                : false,
              menubar: permission === 'edit' ? 'file edit view insert format tools table help' : false,
              branding: false,
              skin: 'borderless',
              readonly: permission !== 'edit',
              toolbar_mode: 'sliding',
              toolbar_sticky: false,
              contextmenu: 'link image table',
              quickbars_selection_toolbar: 'bold italic | quicklink h2 h3 blockquote quickimage quicktable',
              quickbars_insert_toolbar: 'quickimage quicktable',
              paste_data_images: true,
              automatic_uploads: true,
              file_picker_types: 'image',
              // Enhanced content style with cursor support
              content_style: `
                body { 
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; 
                  font-size: 16px; 
                  line-height: 1.6; 
                  color: #3B3B1A;
                  background: transparent;
                  padding: 20px;
                  margin: 0;
                  min-height: 100%;
                  box-sizing: border-box;
                  position: relative;
                }
                p { margin-bottom: 16px; }
                h1, h2, h3, h4, h5, h6 { 
                  color: #8A784E; 
                  margin: 24px 0 12px 0;
                  font-weight: 600;
                }
                .collaborator-cursor {
                  position: absolute;
                  width: 2px;
                  height: 20px;
                  pointer-events: none;
                  z-index: 1000;
                  animation: blink 1s infinite;
                }
                .collaborator-cursor-label {
                  position: absolute;
                  top: -25px;
                  left: 0;
                  background: rgba(0,0,0,0.8);
                  color: white;
                  padding: 2px 6px;
                  border-radius: 3px;
                  font-size: 12px;
                  white-space: nowrap;
                  pointer-events: none;
                }
                @keyframes blink {
                  0%, 50% { opacity: 1; }
                  51%, 100% { opacity: 0; }
                }
                @media (max-width: 768px) {
                  body {
                    padding: 12px;
                    font-size: 16px;
                  }
                }
              `,
              // MOBILE SPECIFIC SETTINGS
              mobile: {
                toolbar_mode: 'sliding',
                menubar: false,
                plugins: [
                  'lists', 'autolink', 'link', 'image', 'charmap',
                  'searchreplace', 'code', 'insertdatetime', 'media',
                  'table', 'emoticons', 'paste', 'textcolor', 'help'
                ],
                toolbar: permission === 'edit' 
                  ? 'undo redo | bold italic | alignleft aligncenter alignright | bullist numlist | link image | removeformat'
                  : false
              },
              statusbar: false,
              resize: false,
              auto_focus: false,
              // ADVANCED FEATURES
              save_onsavecallback: () => {
                if (permission === 'edit') {
                  handleSave();
                }
              },
              save_enablewhendirty: true,
              autosave_interval: '30s',
              autosave_prefix: 'scribe-autosave-{path}{query}-{id}-',
              autosave_restore_when_empty: false,
              autosave_retention: '2m',
              // SETUP FUNCTION
              setup: function(editor) {
                editor.on('init', function() {
                  editor.getContainer().style.border = 'none';
                });
                
                // Custom keyboard shortcuts
                editor.addShortcut('ctrl+s', 'Save note', () => {
                  if (permission === 'edit') {
                    handleSave();
                  }
                });
              }
            }}
            value={content}
            onEditorChange={handleEditorChange}
          />
        </div>
      </div>

      {/* Share Modal */}
      <ShareModal
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        note={foundNote}
        onShareUpdate={handleShareUpdate}
      />
    </div>
  );
}