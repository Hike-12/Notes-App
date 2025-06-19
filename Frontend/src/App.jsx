import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import TextEditor from './components/TextEditor';
import AuthModal from './components/AuthModal';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import './App.css';

function AppContent() {
  const [notes, setNotes] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const { user, loading, isAuthenticated,authCheck } = useAuth();
  

  // Fetch notes initially
  useEffect(() => {
    if (isAuthenticated) {
      fetch('http://localhost:8000/api/sidebar/', {
        credentials: 'include'
      })
        .then(response => {
          if (response.status === 401) {
            setAuthModalOpen(true);
            return [];
          }
          return response.json();
        })
        .then(data => setNotes(data))
        .catch(error => console.error('Error fetching notes:', error));
    }
  }, [isAuthenticated]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#E7EFC7]">
        <div className="bg-white/40 backdrop-blur-sm rounded-2xl p-8 shadow-lg border border-white/20">
          <div className="flex items-center space-x-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#8A784E]"></div>
            <span className="text-[#3B3B1A] font-medium text-lg">Loading Scribe...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#E7EFC7]">
        <div className="text-center">
          <div className="bg-white/40 backdrop-blur-sm rounded-2xl p-8 shadow-lg border border-white/20 mb-6">
            <h1 className="text-4xl font-bold text-[#3B3B1A] mb-4 flex items-center justify-center">
              <img src="/logo.png" alt="Scribe Logo" className="w-10 h-10 mr-3" />
              Scribe
            </h1>
            <p className="text-[#8A784E] text-lg mb-6">
              Collaborative note-taking made simple
            </p>
            <button
              onClick={() => setAuthModalOpen(true)}
              className="bg-[#8A784E] hover:bg-[#3B3B1A] text-white font-semibold py-3 px-8 rounded-xl shadow-lg transition-all duration-300 transform hover:scale-105"
            >
              Get Started
            </button>
          </div>
        </div>
        
        <AuthModal 
          isOpen={authModalOpen} 
          onClose={() => setAuthModalOpen(false)} 
        />
      </div>
    );
  }

  return (
    <Router>
      <div className="flex h-screen bg-[#E7EFC7] overflow-hidden">
        {/* Mobile overlay */}
        {sidebarOpen && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <div className={`
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0 fixed lg:relative z-30 lg:z-0
          w-80 h-full bg-[#AEC8A4] shadow-xl border-r border-[#8A784E]/20
          transition-transform duration-300 ease-in-out
        `}>
          <Sidebar notes={notes} setSidebarOpen={setSidebarOpen} />
        </div>

        {/* Main Content Area */}
        <div className="flex-1 bg-[#E7EFC7] min-w-0">
          <Routes>
            {/* Route to handle both note creation and editing */}
            <Route
              path="/edit-note/:id?"
              element={<TextEditor notes={notes} setSidebarOpen={setSidebarOpen} />}
            />
            {/* Default route or home page */}
            <Route
              path="/"
              element={
                <div className="flex flex-col items-center justify-center h-full bg-[#E7EFC7] p-4">
                  {/* Mobile menu button */}
                  <button
                    onClick={() => setSidebarOpen(true)}
                    className="lg:hidden fixed top-4 left-4 z-10 p-3 rounded-xl bg-[#8A784E] text-white shadow-lg hover:bg-[#3B3B1A] transition-colors duration-200"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                  </button>

                  {/* Welcome content */}
                  <div className="text-center max-w-2xl mx-auto">
                    <div className="bg-white/40 backdrop-blur-sm rounded-3xl p-8 sm:p-12 shadow-2xl border border-white/20">
                      <h1 className="text-4xl sm:text-6xl font-bold text-[#3B3B1A] mb-6 flex items-center justify-center">
                        <img src="/logo.png" alt="Scribe Logo" className="w-10 h-10 mr-3" />
                        Scribe
                      </h1>
                      <p className="text-lg sm:text-xl text-[#8A784E] mb-8 leading-relaxed">
                        Welcome back, <span className="font-semibold">{user?.first_name || user?.username}</span>! 
                        Ready to create something amazing?
                      </p>
                      <p className="text-base sm:text-lg text-[#8A784E] opacity-75 mb-8">
                        Select a note from the sidebar to start editing, or create a new one to begin your next masterpiece.
                      </p>
                    </div>
                  </div>
                </div>
              }
            />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;