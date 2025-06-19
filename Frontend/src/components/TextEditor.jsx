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
  // All your existing state and useEffect remain the same...
  const { id } = useParams();
  const navigate = useNavigate();
  const editorRef = useRef(null);
  const isUpdatingFromWS = useRef(false);
  const currentUserId = useRef(`user_${Math.random().toString(36).substr(2, 9)}`);

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
  const [showMobileActions, setShowMobileActions] = useState(false); // Add this for mobile menu

  // All your existing WebSocket and useEffect code remains the same...
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
          [userId]: { position, userName, color }
        }));
      }
    }
  );

  // All your existing useEffect, handlers remain the same...
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

  // All your existing handlers remain the same...
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

  const handleCursorChange = (editor) => {
    if (!isUpdatingFromWS.current && id && isConnected) {
      const selection = editor.selection;
      const range = selection.getRng();
      const position = {
        startContainer: range.startContainer,
        startOffset: range.startOffset,
        endContainer: range.endContainer,
        endOffset: range.endOffset
      };
      
      sendCursorPosition(
        position, 
        currentUserId.current, 
        `User${currentUserId.current.slice(-4)}`,
        '#FF6B6B'
      );
    }
  };

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

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#E7EFC7] p-4">
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
      <div className="h-screen flex items-center justify-center bg-[#E7EFC7] p-4">
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
    <div className="h-screen bg-[#E7EFC7] flex flex-col relative">
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

      {/* Header */}
      <div className="bg-white/30 backdrop-blur-sm border-b border-white/20 px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex items-center justify-between">
          {/* Left side - Navigation and Title */}
          <div className="flex items-center space-x-3 min-w-0 flex-1">
            {/* Mobile menu button */}
            <button
              onClick={() => setSidebarOpen && setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg bg-white/40 hover:bg-white/60 transition-colors duration-200 border border-white/20 flex-shrink-0"
            >
              <svg className="w-5 h-5 text-[#8A784E]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            {/* Back button for desktop */}
            <button 
              onClick={() => navigate('/')}
              className="hidden lg:block p-2 rounded-lg bg-white/40 hover:bg-white/60 transition-colors duration-200 border border-white/20 flex-shrink-0"
            >
              <svg className="w-5 h-5 text-[#8A784E]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            {/* Title and Status */}
            <div className="min-w-0 flex-1">
              <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-[#3B3B1A] truncate">
                {isNewNote ? 'New Note' : foundNote?.title || 'Edit Note'}
              </h1>
              
              {/* Status bar - Responsive */}
              <div className="flex items-center space-x-2 mt-1 text-xs">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className="text-[#8A784E] truncate">
                  {isConnected ? 'Connected' : 'Disconnected'}
                </span>
                
                {/* Collaborators count - hide on very small screens */}
                <div className="hidden xs:flex items-center space-x-1">
                  <span className="text-[#8A784E]">•</span>
                  <span className="text-[#8A784E]">
                    {collaborators.length} collaborator{collaborators.length !== 1 ? 's' : ''}
                  </span>
                </div>
                
                {/* Permission indicator */}
                {!isNewNote && (
                  <div className="hidden sm:flex items-center space-x-1">
                    <span className="text-[#8A784E]">•</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs ${
                      permission === 'edit' 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {permission === 'edit' ? 'Can Edit' : 'View Only'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {/* Right side - Action buttons */}
          <div className="flex items-center space-x-2">
            {/* Collaborators avatars - hidden on mobile */}
            {collaborators.length > 0 && (
              <div className="hidden md:flex items-center space-x-1 mr-2">
                {collaborators.slice(0, 2).map((collaborator) => (
                  <div
                    key={collaborator.user_identifier}
                    className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-semibold shadow-lg"
                    style={{ backgroundColor: collaborator.color }}
                    title={collaborator.user_name}
                  >
                    {collaborator.user_name.charAt(0).toUpperCase()}
                  </div>
                ))}
                {collaborators.length > 2 && (
                  <div className="w-7 h-7 rounded-full bg-[#8A784E] flex items-center justify-center text-white text-xs font-semibold shadow-lg">
                    +{collaborators.length - 2}
                  </div>
                )}
              </div>
            )}

            {/* Desktop action buttons */}
            <div className="hidden md:flex items-center space-x-2">
              {!isNewNote && isOwner && (
                <button 
                  onClick={() => setShareModalOpen(true)}
                  className="bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-lg font-medium shadow-lg transition-all duration-200 flex items-center text-sm"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
                  </svg>
                  Share
                </button>
              )}

              {permission === 'edit' && (
                <button 
                  onClick={handleSave} 
                  disabled={isSaving}
                  className="bg-[#8A784E] hover:bg-[#3B3B1A] text-white py-2 px-4 rounded-lg font-medium shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center text-sm"
                >
                  {isSaving ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Saving...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 0V6a2 2 0 00-2-2H9a2 2 0 00-2 2v1m1 0h4m-4 0v9m4-9v9" />
                      </svg>
                      Save
                    </>
                  )}
                </button>
              )}
              
              {!isNewNote && isOwner && (
                <button 
                  onClick={handleDelete} 
                  className="bg-red-500 hover:bg-red-600 text-white py-2 px-4 rounded-lg font-medium shadow-lg transition-all duration-200 flex items-center text-sm"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Delete
                </button>
              )}
            </div>

            {/* Mobile menu button */}
            <button
              onClick={() => setShowMobileActions(!showMobileActions)}
              className="md:hidden p-2 rounded-lg bg-white/40 hover:bg-white/60 transition-colors duration-200 border border-white/20"
            >
              <svg className="w-5 h-5 text-[#8A784E]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile actions dropdown */}
        {showMobileActions && (
          <div className="md:hidden mt-3 p-3 bg-white/50 rounded-lg border border-white/30 space-y-2">
            {/* Permission indicator on mobile */}
            {!isNewNote && (
              <div className="flex items-center space-x-2 pb-2 border-b border-white/30">
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  permission === 'edit' 
                    ? 'bg-green-100 text-green-700' 
                    : 'bg-yellow-100 text-yellow-700'
                }`}>
                  {permission === 'edit' ? 'Can Edit' : 'View Only'}
                </span>
                {!isOwner && foundNote?.owner && (
                  <span className="text-xs text-[#8A784E]">
                    Shared by {foundNote.owner.username}
                  </span>
                )}
              </div>
            )}

            {/* Collaborators on mobile */}
            {collaborators.length > 0 && (
              <div className="flex items-center space-x-2 pb-2 border-b border-white/30">
                <span className="text-xs text-[#8A784E] font-medium">Collaborators:</span>
                <div className="flex items-center space-x-1">
                  {collaborators.slice(0, 3).map((collaborator) => (
                    <div
                      key={collaborator.user_identifier}
                      className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-semibold"
                      style={{ backgroundColor: collaborator.color }}
                      title={collaborator.user_name}
                    >
                      {collaborator.user_name.charAt(0).toUpperCase()}
                    </div>
                  ))}
                  {collaborators.length > 3 && (
                    <span className="text-xs text-[#8A784E]">+{collaborators.length - 3}</span>
                  )}
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="space-y-2">
              {!isNewNote && isOwner && (
                <button 
                  onClick={() => {
                    setShareModalOpen(true);
                    setShowMobileActions(false);
                  }}
                  className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 px-3 rounded-lg font-medium transition-colors duration-200 flex items-center justify-center text-sm"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
                  </svg>
                  Share Note
                </button>
              )}

              {permission === 'edit' && (
                <button 
                  onClick={() => {
                    handleSave();
                    setShowMobileActions(false);
                  }} 
                  disabled={isSaving}
                  className="w-full bg-[#8A784E] hover:bg-[#3B3B1A] text-white py-2 px-3 rounded-lg font-medium transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-sm"
                >
                  {isSaving ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Saving...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 0V6a2 2 0 00-2-2H9a2 2 0 00-2 2v1m1 0h4m-4 0v9m4-9v9" />
                      </svg>
                      Save Note
                    </>
                  )}
                </button>
              )}
              
              {!isNewNote && isOwner && (
                <button 
                  onClick={() => {
                    handleDelete();
                    setShowMobileActions(false);
                  }} 
                  className="w-full bg-red-500 hover:bg-red-600 text-white py-2 px-3 rounded-lg font-medium transition-colors duration-200 flex items-center justify-center text-sm"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Delete Note
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Editor */}
      <div className="flex-1 p-2 sm:p-4 lg:p-6 min-h-0">
        <div className="h-full bg-white/40 backdrop-blur-sm rounded-xl sm:rounded-2xl shadow-lg border border-white/20 overflow-hidden">
          <div className="h-full p-2 sm:p-4 lg:p-6">
            <Editor
              apiKey={import.meta.env.VITE_TINYMCE_API_KEY}
              onInit={(evt, editor) => {
                editorRef.current = editor;
                editor.on('NodeChange', () => handleCursorChange(editor));
                editor.on('KeyUp', () => handleCursorChange(editor));
                editor.on('MouseUp', () => handleCursorChange(editor));
              }}
              init={{
                height: '100%',
                plugins: 'link image code lists table emoticons autoresize',
                toolbar: permission === 'edit' 
                  ? 'undo redo | formatselect | bold italic underline | alignleft aligncenter alignright alignjustify | bullist numlist | outdent indent | removeformat | link image | emoticons'
                  : false,
                menubar: false,
                branding: false,
                skin: 'borderless',
                readonly: permission !== 'edit',
                mobile: {
                  toolbar_mode: 'sliding',
                  theme: 'mobile'
                },
                content_style: `
                  body { 
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; 
                    font-size: 16px; 
                    line-height: 1.6; 
                    color: #3B3B1A;
                    background: transparent;
                    padding: 12px;
                    ${permission !== 'edit' ? 'pointer-events: none; user-select: text;' : ''}
                  }
                  @media (min-width: 640px) {
                    body {
                      font-size: 16px;
                      padding: 20px;
                    }
                  }
                  @media (min-width: 1024px) {
                    body {
                      font-size: 16px;
                      padding: 24px;
                    }
                  }
                  p { margin-bottom: 16px; }
                  h1, h2, h3, h4, h5, h6 { color: #8A784E; margin: 20px 0 10px 0; }
                  .collaborator-cursor {
                    position: absolute;
                    width: 2px;
                    height: 20px;
                    pointer-events: none;
                    z-index: 1000;
                  }
                `,
                statusbar: false,
                resize: false,
                toolbar_mode: 'sliding',
                toolbar_sticky: true,
                toolbar_sticky_offset: 0,
              }}
              value={content}
              onEditorChange={handleEditorChange}
            />
          </div>
        </div>
      </div>

      {/* Share Modal */}
      <ShareModal
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        note={foundNote}
        onShareUpdate={handleShareUpdate}
      />

      {/* Overlay to close mobile actions */}
      {showMobileActions && (
        <div 
          className="fixed inset-0 bg-black/20 z-10 md:hidden"
          onClick={() => setShowMobileActions(false)}
        />
      )}
    </div>
  );
}