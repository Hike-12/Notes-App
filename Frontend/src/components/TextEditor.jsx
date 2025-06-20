import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import QuillEditor from './QuillEditor.jsx';
import { useYjs } from '../hooks/useYjs.jsx';
import ShareModal from './ShareModal.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';

// Utility functions for Quill HTML content
const extractTitle = (htmlContent) => {
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = htmlContent;
  const firstParagraph = tempDiv.querySelector('p');
  return firstParagraph ? firstParagraph.innerText.trim() : '';
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
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const quillRef = useRef(null);
  const editorInitialized = useRef(false);

  // State variables
  const [content, setContent] = useState('');
  const [isNewNote, setIsNewNote] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [foundNote, setFoundNote] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [permission, setPermission] = useState('edit');
  const [isOwner, setIsOwner] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [collaborators, setCollaborators] = useState([]);

  // Initialize Yjs after Quill is ready
  const { isConnected, collaborators: yjsCollaborators } = useYjs(
    id && quillRef.current ? id : null, 
    quillRef
  );

  // Fetch note data
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
            setContent(data.body || '<p></p>'); 
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
        // New note
        setContent('<p></p>');
        setIsNewNote(true);
        setPermission('edit');
        setIsOwner(true);
        setLoading(false);
      }
    };

    fetchData();
  }, [id, navigate]);

  // Handle Quill editor changes
  const handleEditorChange = (newContent) => {
    if (permission !== 'edit') {
      return;
    }
    setContent(newContent);
  };

  // Handle Quill editor initialization
  const handleQuillInit = (quill) => {
    quillRef.current = quill;
    editorInitialized.current = true;
    console.log('📝 Quill editor initialized for collaboration');
  };

  // Save note
  const handleSave = () => {
    if (permission !== 'edit') {
      alert('You do not have permission to edit this note.');
      return;
    }

    setIsSaving(true);
    const title = extractTitle(content) || 'Untitled Note';
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
          console.log('Content saved:', data);
          
          if (isNewNote) {
            navigate(`/edit-note/${data.id}`, { replace: true });
            setTimeout(() => {
              window.location.reload();
            }, 1000);
          } else {
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
        alert('Failed to save note. Please try again.');
      });
  };

  // Delete note
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

  // Handle share updates
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

  // Loading state
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

  // Error state
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

      {/* Header */}
      <div className="bg-white/30 backdrop-blur-sm border-b border-white/20 p-4 flex-shrink-0 relative z-30">
        <div className="flex items-center justify-between mb-2">
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

          <button
            onClick={() => setShowMobileMenu(!showMobileMenu)}
            className="lg:hidden p-2 rounded-lg bg-white/40 hover:bg-white/60 transition-colors relative z-40"
          >
            <svg className="w-5 h-5 text-[#8A784E]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
            </svg>
          </button>
        </div>

        {/* Desktop status */}
        <div className="hidden lg:flex items-center justify-between">
          <div className="flex items-center space-x-2 text-sm text-[#8A784E]">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
            <span>•</span>
            <span>{yjsCollaborators.length} collaborator{yjsCollaborators.length !== 1 ? 's' : ''}</span>
            
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

        {/* Mobile menu */}
        {showMobileMenu && (
          <div className="lg:hidden absolute top-full left-4 right-4 mt-2 p-3 bg-white/95 backdrop-blur-sm rounded-lg shadow-xl border border-white/30 z-50">
            <div className="flex items-center space-x-2 text-sm text-[#8A784E] mb-3">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
              <span>•</span>
              <span>{yjsCollaborators.length} collaborator{yjsCollaborators.length !== 1 ? 's' : ''}</span>
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

      {/* Editor Container */}
      <div className="flex-1 p-4 min-h-0 overflow-hidden relative">
        <div className="w-full h-full bg-white/40 backdrop-blur-sm rounded-xl shadow-lg border border-white/20 overflow-hidden">
          {/* Connection status indicator for editor */}
          <div className="flex items-center justify-between px-4 py-2 bg-white/20 border-b border-white/20">
            <div className="flex items-center space-x-2 text-xs text-[#8A784E]">
              <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></span>
              <span>{isConnected ? 'Real-time collaboration active' : 'Offline mode'}</span>
              {yjsCollaborators.length > 0 && (
                <>
                  <span>•</span>
                  <span>{yjsCollaborators.length} user{yjsCollaborators.length !== 1 ? 's' : ''} editing</span>
                </>
              )}
            </div>
            {permission !== 'edit' && (
              <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full">
                Read Only
              </span>
            )}
          </div>

          {/* Quill Editor */}
          <div className="h-full">
            <QuillEditor
              value={content}
              onChange={handleEditorChange}
              onInit={handleQuillInit}
              readOnly={permission !== 'edit'}
              placeholder={permission === 'edit' ? 'Start writing your note...' : 'This note is read-only'}
              className="h-full"
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
    </div>
  );
}