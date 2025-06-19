import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function Sidebar({ notes, setSidebarOpen }) {
  const navigate = useNavigate();

  const handleNoteClick = (id) => {
    navigate(`/edit-note/${id}`);
    if (setSidebarOpen) setSidebarOpen(false); // Close mobile sidebar
  };

  const handleNewNote = () => {
    navigate('/edit-note');
    if (setSidebarOpen) setSidebarOpen(false); // Close mobile sidebar
  };

  return (
    <div className="h-full flex flex-col bg-[#AEC8A4]">
      {/* Header */}
      <div className="p-4 sm:p-6 border-b border-[#8A784E]/20">
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-[#3B3B1A] flex items-center">
            <svg className="w-6 h-6 sm:w-8 sm:h-8 mr-2 sm:mr-3 text-[#8A784E]" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
              <path fillRule="evenodd" d="M4 5a2 2 0 012-2v1a2 2 0 00-2 2v6a2 2 0 002 2h8a2 2 0 002-2V6a2 2 0 00-2-2V3a2 2 0 012-2v1a3 3 0 013 3v6a3 3 0 01-3 3H6a3 3 0 01-3-3V5z" clipRule="evenodd" />
            </svg>
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
          Your Notes ({notes.length})
        </h2>
        
        <div className="space-y-3">
          {notes.length > 0 ? (
            notes.map(note => (
              <div
                key={note.id}
                className="bg-white/40 backdrop-blur-sm rounded-2xl p-3 sm:p-4 border border-white/20 cursor-pointer hover:bg-white/60 hover:shadow-lg transition-all duration-300 transform hover:scale-102 group"
                onClick={() => handleNoteClick(note.id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base sm:text-lg font-semibold text-[#3B3B1A] group-hover:text-[#8A784E] transition-colors duration-200 line-clamp-2 break-words">
                      {note.title || 'Untitled Note'}
                    </h3>
                    <p className="text-xs sm:text-sm text-[#8A784E] mt-1 opacity-70">
                      Click to edit
                    </p>
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