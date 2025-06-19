import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Sidebar({ notes, setSidebarOpen }) {
  const navigate = useNavigate();
  const [notesData, setNotesData] = useState([]);
  const { user, logout } = useAuth();

  // Fetch notes with collaboration info
  useEffect(() => {
    const fetchNotes = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/sidebar/`, {
          credentials: 'include'
        });
        
        if (response.status === 401) {
          // User not authenticated, redirect to login
          navigate('/');
          return;
        }
        
        const data = await response.json();
        setNotesData(data);
      } catch (error) {
        console.error('Error fetching notes:', error);
      }
    };

    fetchNotes();
    // Refresh every 30 seconds to update collaboration status
    const interval = setInterval(fetchNotes, 30000);
    return () => clearInterval(interval);
  }, [navigate]);

  const handleNoteClick = (id) => {
    navigate(`/edit-note/${id}`);
    if (setSidebarOpen) setSidebarOpen(false);
  };

  const handleNewNote = () => {
    navigate('/edit-note');
    if (setSidebarOpen) setSidebarOpen(false);
  };

  const formatTimeAgo = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now - date) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays}d ago`;
  };

return (
    <div className="h-full flex flex-col bg-[#AEC8A4]">
      {/* Header */}
      <div className="p-4 sm:p-6 border-b border-[#8A784E]/20">
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-[#3B3B1A] flex items-center">
            <img src="/logo.png" alt="Scribe Logo" className="w-8 h-8 sm:w-10 sm:h-10 mr-2" />
            Scribe
          </h1>
          
          {/* Mobile close button */}
          <button
            onClick={() => setSidebarOpen && setSidebarOpen(false)}
            className="lg:hidden p-2 rounded-lg bg-white/40 hover:bg-white/60 transition-colors duration-200"
          >
            <svg className="w-5 h-5 text-[#8A784E]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* User info and logout */}
        <div className="mb-4 p-3 bg-white/30 rounded-xl border border-white/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[#3B3B1A]">
                {user?.first_name || user?.username}
              </p>
              <p className="text-xs text-[#8A784E] opacity-70">
                @{user?.username}
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 rounded-lg bg-red-100 hover:bg-red-200 text-red-600 transition-colors duration-200 group"
              title="Logout"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
        
        <button 
          onClick={handleNewNote}
          className="w-full bg-[#8A784E] hover:bg-[#3B3B1A] text-white font-semibold py-2.5 sm:py-3 px-4 sm:px-6 rounded-xl shadow-lg transition-all duration-300 transform hover:scale-105 hover:shadow-xl flex items-center justify-center"
        >
          <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Note
        </button>
      </div>

      {/* Notes List */}
      <div className="flex-1 p-4 sm:p-6 overflow-y-auto">
        <h2 className="text-lg sm:text-xl font-semibold text-[#3B3B1A] mb-4 flex items-center">
          <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-[#8A784E]" fill="currentColor" viewBox="0 0 20 20">
            <path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z" />
          </svg>
          Your Notes ({notesData.length})
        </h2>
        
        <div className="space-y-3">
          {notesData.length > 0 ? (
            notesData.map(note => (
              <div
                key={note.id}
                className="bg-white/40 backdrop-blur-sm rounded-2xl p-3 sm:p-4 border border-white/20 cursor-pointer hover:bg-white/60 hover:shadow-lg transition-all duration-300 transform hover:scale-102 group"
                onClick={() => handleNoteClick(note.id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center space-x-2">
                        <h3 className="text-base sm:text-lg font-semibold text-[#3B3B1A] group-hover:text-[#8A784E] transition-colors duration-200 line-clamp-1 break-words">
                          {note.title || 'Untitled Note'}
                        </h3>
                        
                        {/* Owner/Shared indicator */}
                        {!note.is_owner && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                            Shared
                          </span>
                        )}
                        
                        {/* Permission indicator */}
                        {note.permission === 'view' && (
                          <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full">
                            View Only
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center space-x-1">
                        {/* Collaboration indicator */}
                        {note.collaborators > 0 && (
                          <div className="flex items-center space-x-1 text-xs text-[#8A784E] bg-green-100 px-2 py-1 rounded-full">
                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                            <span>{note.collaborators}</span>
                          </div>
                        )}
                        
                        {/* Share count indicator for owned notes */}
                        {note.is_owner && note.shared_count > 0 && (
                          <div className="flex items-center space-x-1 text-xs text-[#8A784E] bg-purple-100 px-2 py-1 rounded-full">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
                            </svg>
                            <span>{note.shared_count}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <p className="text-xs sm:text-sm text-[#8A784E] opacity-70">
                        {note.collaborators > 0 ? 'Being edited' : 
                         note.permission === 'view' ? 'View only' : 'Click to edit'}
                        {!note.is_owner && note.shared_by && (
                          <span className="block text-xs opacity-50">
                            by {note.shared_by}
                          </span>
                        )}
                      </p>
                      <span className="text-xs text-[#8A784E] opacity-50">
                        {formatTimeAgo(note.last_modified)}
                      </span>
                    </div>
                  </div>
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 text-[#8A784E] opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex-shrink-0 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-6 sm:py-8">
              <svg className="w-12 h-12 sm:w-16 sm:h-16 mx-auto text-[#8A784E] opacity-30 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-[#8A784E] opacity-60 text-sm sm:text-base">No notes yet</p>
              <p className="text-xs sm:text-sm text-[#8A784E] opacity-40 mt-1">Create your first note to get started</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}