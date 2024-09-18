import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function Sidebar({ notes }) {
  const navigate = useNavigate();

  const handleNoteClick = (id) => {
    navigate(`/edit-note/${id}`);
  };

  return (
    <div className="sidebar p-4 h-full overflow-y-auto">
      <button 
        onClick={() => navigate('/edit-note')} 
        className="border border-gray-200 text-white font-bold py-2 px-4 my-2 rounded hover:bg-blue-600 transition duration-200"
      >
        + New Note
      </button>
      <h2 className="text-2xl font-bold mb-4">Your Notes</h2>
      <ul className="space-y-4">
        {notes.map(note => (
          <li
            key={note.id}
            className="shadow-md rounded-lg p-4 border border-gray-200 cursor-pointer"
            onClick={() => handleNoteClick(note.id)}
          >
            <h3 className="text-xl font-bold">{note.title || 'Untitled'}</h3>
          </li>
        ))}
      </ul>
    </div>
  );
}
