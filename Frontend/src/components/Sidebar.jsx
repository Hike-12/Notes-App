import React, { useEffect } from "react"

export default function Sidebar(){
const [notes,setNotes] = React.useState([])

useEffect(()=>{
    fetch("http://127.0.0.1:8000/api/frontpage")
    .then(response => response.json())
    .then(notes => {
        setNotes(notes)
    })
},[])

    return(
    <div className="sidebar">
      <h2>Notes</h2>
        {notes.map(note => (
          <div key={note.id}>
            <h3>{note.title}</h3>
          </div>
        ))}
    </div>
    )
}