import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import './App.css';
import TextEditor from './components/TextEditor';
import Sidebar from './components/Sidebar';

function App() {
  const [notes, setNotes] = useState([]);

  // Fetch notes initially
  useEffect(() => {
    fetch('http://localhost:8000/api/sidebar/')
      .then(response => response.json())
      .then(data => setNotes(data))
      .catch(error => console.error('Error fetching notes:', error));
  }, []);

  return (
    <Router>
      <div className="flex h-screen">
        {/* Sidebar */}
        <div className="w-64 bg-gray-800 text-white p-4">
          <Sidebar notes={notes} />
        </div>

        {/* Main Content Area */}
        <div className="flex-1 p-4">
          <Routes>
            {/* Route to handle both note creation and editing */}
            <Route
              path="/edit-note/:id?"
              element={<TextEditor notes={notes} />}
            />
            {/* Default route or home page */}
            <Route
              path="/"
              element={
                <div className="flex items-center justify-center h-full">
                  <p className="text-gray-500">Select a note to edit or create a new one</p>
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
