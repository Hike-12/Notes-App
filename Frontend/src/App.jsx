import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import './App.css';
import TextEditor from './components/TextEditor';
import Sidebar from './components/Sidebar';

function App() {
  const [notes, setNotes] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Fetch notes initially
  useEffect(() => {
    fetch('http://localhost:8000/api/sidebar/')
      .then(response => response.json())
      .then(data => setNotes(data))
      .catch(error => console.error('Error fetching notes:', error));
  }, []);

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
                    className="lg:hidden fixed top-4 left-4 z-10 p-3 bg-white/40 backdrop-blur-sm rounded-xl shadow-lg border border-white/20"
                  >
                    <svg className="w-6 h-6 text-[#8A784E]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                  </button>

                  <div className="text-center p-6 sm:p-8 bg-white/30 backdrop-blur-sm rounded-3xl shadow-lg border border-white/20 max-w-md w-full">
                    <div className="mb-6">
                      <svg className="w-16 h-16 sm:w-20 sm:h-20 mx-auto text-[#8A784E] opacity-60" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 0v12h8V4H6z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <h2 className="text-xl sm:text-2xl font-bold text-[#3B3B1A] mb-2">Welcome to Scribe</h2>
                    <p className="text-[#8A784E] text-base sm:text-lg">Select a note to edit or create a new one to get started</p>
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

export default App;