import { useState } from "react";
import Navbar from "./Navbar"


export default function Text_Editor () {
  const [noteContent, setNoteContent] = useState('');
  const [noteTitle, setNoteTitle] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('http://127.0.0.1:8000/save-note/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: noteContent ,title:noteTitle}),
      });

      if (!response.ok) {
        throw new Error('Network response was not ok');
      }

      const result = await response.json();
      console.log(result);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  return (
    <>
      <Navbar handleSubmit={handleSubmit} />
      <div className="editor">
        <form>
          <input
            className="title"
            type="text"
            value={noteTitle}
            onChange={(e) => setNoteTitle(e.target.value)}
            />
          <input
            className="body"
            type="text"
            value={noteContent}
            onChange={(e) => setNoteContent(e.target.value)}
            />
        </form>
      </div>
      </>
  );
}