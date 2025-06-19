import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Editor } from '@tinymce/tinymce-react';

// Utility functions
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
  const { id } = useParams();
  const navigate = useNavigate();

  const [content, setContent] = useState('');
  const [isNewNote, setIsNewNote] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [foundNote, setFoundNote] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const fetchData = async () => {
      if (id) {
        try {
          const response = await fetch(`http://localhost:8000/api/get-note/${id}/`);          
          if (!response.ok) {
            throw new Error('Network response was not ok');
          }

          const data = await response.json();

          if (data) {
            setContent(data.body || ''); 
            setFoundNote(data);
            setIsNewNote(false);
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
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);
  
  const handleEditorChange = (newContent) => {
    setContent(newContent);
  };
  
  const handleDelete = () => {
    if (!foundNote || isNewNote) {
      console.warn('No note to delete or it is a new note.');
      return;
    }

    if (window.confirm('Are you sure you want to delete this note? This action cannot be undone.')) {
      fetch(`http://localhost:8000/api/delete-note/${foundNote.id}/`, {
        method: 'DELETE',
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
    setIsSaving(true);
    const title = extractTitle(content);
    const contentWithoutTitle = removeTitleFromContent(content);
    const fullContent = `<p>${title}</p>${contentWithoutTitle}`;

    fetch('http://localhost:8000/api/save-note/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id: isNewNote ? null : foundNote.id,
        content: fullContent,
        title,
      }),
    })
      .then(response => response.json())
      .then(data => {
        setIsSaving(false);
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
            window.location.reload();
          }, 1500);
        }
      })
      .catch(error => {
        console.error('There was an error saving the content!', error);
        setIsSaving(false);
      });
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-[#E7EFC7] p-4">
        <div className="bg-white/40 backdrop-blur-sm rounded-2xl p-6 sm:p-8 shadow-lg border border-white/20">
          <div className="flex items-center space-x-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#8A784E]"></div>
            <span className="text-[#3B3B1A] font-medium text-sm sm:text-base">Loading your note...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center bg-[#E7EFC7] p-4">
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 sm:p-8 shadow-lg max-w-md w-full text-center">
          <svg className="w-10 h-10 sm:w-12 sm:h-12 mx-auto text-red-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="text-base sm:text-lg font-semibold text-red-800 mb-2">Oops! Something went wrong</h3>
          <p className="text-red-600 text-sm sm:text-base">{error}</p>
          <button 
            onClick={() => navigate('/')}
            className="mt-4 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition-colors duration-200 text-sm sm:text-base"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-[#E7EFC7] flex flex-col">
      {/* Success notification */}
      {showSuccess && (
        <div className="fixed top-4 right-4 z-50 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg">
          <div className="flex items-center">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Note saved successfully!
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white/30 backdrop-blur-sm border-b border-white/20 p-4 sm:p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 sm:space-x-4">
            {/* Mobile menu button */}
            <button
              onClick={() => setSidebarOpen && setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg bg-white/40 hover:bg-white/60 transition-colors duration-200 border border-white/20"
            >
              <svg className="w-5 h-5 text-[#8A784E]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            {/* Back button for desktop */}
            <button 
              onClick={() => navigate('/')}
              className="hidden lg:block p-2 rounded-lg bg-white/40 hover:bg-white/60 transition-colors duration-200 border border-white/20"
            >
              <svg className="w-5 h-5 text-[#8A784E]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <h1 className="text-xl sm:text-2xl font-bold text-[#3B3B1A]">
              {isNewNote ? 'New Note' : 'Edit Note'}
            </h1>
          </div>
          
          <div className="flex items-center space-x-2 sm:space-x-3">
            <button 
              onClick={handleSave} 
              disabled={isSaving}
              className="bg-[#8A784E] hover:bg-[#3B3B1A] text-white py-2 px-3 sm:px-6 rounded-xl font-semibold shadow-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed flex items-center text-sm sm:text-base"
            >
              {isSaving ? (
                <>
                  <div className="animate-spin rounded-full h-3 h-3 sm:h-4 sm:w-4 border-b-2 border-white mr-1 sm:mr-2"></div>
                  <span className="hidden sm:inline">Saving...</span>
                  <span className="sm:hidden">Save</span>
                </>
              ) : (
                <>
                  <svg className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 0V6a2 2 0 00-2-2H9a2 2 0 00-2 2v1m1 0h4m-4 0v9m4-9v9" />
                  </svg>
                  Save
                </>
              )}
            </button>
            
            {!isNewNote && (
              <button 
                onClick={handleDelete} 
                className="bg-red-500 hover:bg-red-600 text-white py-2 px-3 sm:px-6 rounded-xl font-semibold shadow-lg transition-all duration-300 transform hover:scale-105 flex items-center text-sm sm:text-base"
              >
                <svg className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                <span className="hidden sm:inline">Delete</span>
                <span className="sm:hidden">Del</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 p-3 sm:p-6">
        <div className="h-full bg-white/40 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 overflow-hidden">
          <div className="h-full p-3 sm:p-6">
            <Editor
              apiKey='ie2xb0cij28mccrbosdqgruuuovzukrhwjy3c4hsm964jz5y'
              init={{
                height: '100%',
                plugins: 'link image code lists table emoticons autoresize',
                toolbar: 'undo redo | formatselect | bold italic underline | alignleft aligncenter alignright alignjustify | bullist numlist | outdent indent | removeformat | link image | emoticons',
                menubar: false,
                branding: false,
                skin: 'borderless',
                content_style: `
                  body { 
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; 
                    font-size: 14px; 
                    line-height: 1.6; 
                    color: #3B3B1A;
                    background: transparent;
                    padding: 10px;
                  }
                  @media (min-width: 640px) {
                    body {
                      font-size: 16px;
                      padding: 20px;
                    }
                  }
                  p { margin-bottom: 16px; }
                  h1, h2, h3, h4, h5, h6 { color: #8A784E; margin: 20px 0 10px 0; }
                `,
                statusbar: false,
                resize: false,
                toolbar_mode: 'sliding',
              }}
              value={content}
              onEditorChange={handleEditorChange}
            />
          </div>
        </div>
      </div>
    </div>
  );
}