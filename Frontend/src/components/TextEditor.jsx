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

export default function TextEditor() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [content, setContent] = useState('');
  const [isNewNote, setIsNewNote] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [foundNote, setFoundNote] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    if (id) {
      // Fetching note data from the server
      fetch(`http://localhost:8000/api/get-note/${id}`)
        .then(response => response.json())
        .then(data => {
          if (data) {
            setContent(data.body || ''); 
            setFoundNote(data); // Save the found note for later use
            setIsNewNote(false);
          } else {
            setError('Note not found');
          }
        })
        .catch(error => {
          setError('There was an error fetching the note!');
          console.error('Error:', error);
        });
    } else {
      // Creating a new note
      setContent('');
      setIsNewNote(true);
    }

    setLoading(false);
  }, [id]);
  
  const handleEditorChange = (newContent) => {
    setContent(newContent);
  };
  
  const handleDelete = () => {
    window.location.reload();
    if (!foundNote || isNewNote) {
      console.warn('No note to delete or it is a new note.');
      return;
    }
  
    fetch(`http://localhost:8000/api/delete-note/${foundNote.id}/`, {
      method: 'DELETE',
    })
      .then(response => {
        if (response.ok) {
          navigate('/'); // Redirect to the home page
        } else {
          console.error('Error deleting note');
        }
      })
      .catch(error => {
        console.error('There was an error deleting the note!', error);
      });
  };
  

  const handleSave = () => {
    window.location.reload();
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
        if (isNewNote) {
          navigate(`/edit-note/${data.id}`);
        } else {
          console.log('Content saved:', data);
        }
      })
      .catch(error => {
        console.error('There was an error saving the content!', error);
      });
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>{error}</div>;
  }

  return (
    <div className="h-full">
      <Editor
        apiKey='ie2xb0cij28mccrbosdqgruuuovzukrhwjy3c4hsm964jz5y'
        init={{
          plugins: 'link image code',
          toolbar: 'undo redo | formatselect | bold italic | alignleft aligncenter alignright alignjustify | bullist numlist outdent indent | removeformat',
          setup: function(editor){
            editor.on('init', function() {
              editor.setContent('<p class="placeholder">Enter Note Title</p><p>Enter Content here</p>');
            });
          }
        }}
        value={content}
        onEditorChange={handleEditorChange}
      />

      <button onClick={handleSave} className="mt-4 bg-blue-500 text-white py-2 px-4 rounded">
        Save
      </button>
      {!isNewNote && (
        <button onClick={handleDelete} className="mt-4 bg-red-500 text-white py-2 px-4 rounded">
          Delete
        </button>)}
    </div>
  );
}

