import { useState, useEffect } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import Text_Editor from './components/Text_Editor'
import Sidebar from './components/Sidebar'

function App() { 

  return (
    <div class = "app">
      <Sidebar />
      <Text_Editor />
    </div>
  )
}

export default App



// This is to check if the api is connected or not

// const [data,setData] = useState(null)
// const [loading,setLoading] = useState(true)
// const [error,setError] = useState(null)

// useEffect(() => {
//   fetch("http://127.0.0.1:8000/api/frontpage")
//   .then(response => response.json())
//   .then(data => {
//     setData(data);
//     setLoading(false);
//   })
//   .catch(error => {
//     console.log("Error fetching data",error);
//     setError(error)
//     setLoading(false)
//   })
// },[])
//   if (loading) return <div>Loading...</div>;
//   if (error) return <div>Error: {error.message}</div>;
  // return(
  //   <h1>Data from API:</h1>
  //     <p>{JSON.stringify(data, null, 2)}</p>
  // )