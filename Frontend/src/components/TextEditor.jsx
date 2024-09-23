import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Editor } from '@tinymce/tinymce-react';
import { useLocation } from 'react-router-dom';

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
  const location = useLocation();
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
            setFoundNote(data); // Save the found note for later use
            setIsNewNote(false);
          } else {
            setError('Note not found');
          }
        } catch (error) {
          setError('There was an error fetching the note!');
          console.error('Error:', error);
        } finally {
          setLoading(false); // Move setLoading here
        }
      } else {
        // Creating a new note
        setContent('');
        setIsNewNote(true);
        setLoading(false); // Ensure loading is set to false here too
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
  
    fetch(`http://localhost:8000/api/delete-note/${foundNote.id}/`, {
      method: 'DELETE',
    })
      .then(response => {
        if (response.ok) {
          navigate('/');// Redirect to the home page
          window.location.reload(); 
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
          navigate(`/edit-note/${data.id}`, { replace: true });
          window.location.reload();
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
      {loading && <div>Loading...</div>}
      {error && <div>{error}</div>}
      
      <Editor
        apiKey='ie2xb0cij28mccrbosdqgruuuovzukrhwjy3c4hsm964jz5y'
        init={{
          plugins: 'link image code',
          toolbar: 'undo redo | formatselect | bold italic | alignleft aligncenter alignright alignjustify | bullist numlist outdent indent | removeformat',
          menubar: false,
        }}
        value={content}
        onEditorChange={handleEditorChange}
      />
  
      <button onClick={handleSave} className="mt-4 bg-blue-500 text-white py-2 px-4 rounded">
        Save
      </button>
      {!isNewNote && (
        <button onClick={handleDelete} className="mx-3 mt-4 bg-red-500 text-white py-2 px-4 rounded">
          Delete
        </button>
      )}
    </div>
  );
}

