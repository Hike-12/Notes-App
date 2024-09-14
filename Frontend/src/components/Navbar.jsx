import { useState } from "react";

export default function Navbar (props) {
  return(
    <div className="navbar">
      <button onClick = {props.handleSubmit}>Save</button>
    </div>
  )
}
