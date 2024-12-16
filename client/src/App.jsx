import React, { useEffect, useState } from "react";
import { io } from "socket.io-client";
import moment from "moment";

const SOCKET_URL = "http://localhost:3000";
const IMAGE_URL = "http://localhost:3000/images";

function App() {
  const [notes, setNotes] = useState([]);

  useEffect(() => {
    // Connect to Socket.IO server
    const socket = io(SOCKET_URL);

    // Listen for real-time updates
    socket.on("notesUpdated", (updatedNotes) => {
      console.log("Received updated notes:", updatedNotes);
      setNotes(updatedNotes);
    });

    // Clean up connection on unmount
    return () => socket.disconnect();
  }, []);

  // Helper function to render content with images
  const renderContentWithImages = (content) => {
    const imageRegex = /!\[\[(.*?)\]\]/g;
    return content.split("\n").map((line, index) => {
      const match = imageRegex.exec(line);
      if (match) {
        const imageName = match[1].trim().replace(/\s+/g, "_");
        return (
          <img
            key={index}
            src={`${IMAGE_URL}/${imageName}`}
            alt={imageName}
            style={{ maxWidth: "100%", marginTop: "10px" }}
          />
        );
      }
      return <p key={index}>{line}</p>;
    });
  };

  // Helper function to format the timestamp
  const formatTimestamp = (updatedAt, createdAt) => {
    const time = updatedAt || createdAt;
    return time ? moment(time).fromNow() : "Unknown time";
  };

  return (
    <div style={{ padding: "20px" }}>
      <h1 style={{ marginBottom: "20px" }}>My Notes</h1>
      {notes.length === 0 ? (
        <p>No notes found.</p>
      ) : (
        notes.map((note) => (
          <div
            key={note._id}
            style={{
              border: "1px solid #ddd",
              borderRadius: "5px",
              padding: "15px",
              margin: "10px 0",
              boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
            }}
          >
            {/* Remove .md extension */}
            <h3 style={{ marginBottom: "5px", fontWeight: "bold" }}>
              {note.name.replace(/\.md$/, "") || "Untitled"}
            </h3>

            {/* Content with spacing */}
            <div style={{ color: "#555", paddingBottom: "30px" }}>              
              {renderContentWithImages(note.content || "No content available")}
            </div>
            
            <p
              style={{
                fontSize: "12px",
                color: "#888",               
                paddingTop: "30px",            
              }}
            >
              {formatTimestamp(note.updatedAt, note.createdAt)}
            </p>
          </div>
        ))
      )}
    </div>
  );
}

export default App;
