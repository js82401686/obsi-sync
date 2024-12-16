const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const http = require('http'); // HTTP server for Socket.IO
const { Server } = require('socket.io'); // Socket.IO
const fs = require('fs');

const app = express();
const server = http.createServer(app); // Create HTTP server
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3001", // React frontend URL
    methods: ["GET", "POST"],
  },
});

// Enable CORS and body parser
app.use(cors());
app.use(bodyParser.json());

// MongoDB connection
const MONGO_URI = 'mongodb://mongodb:27017/mynotes';
mongoose.connect(MONGO_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error('Error connecting to MongoDB:', err));

// Note schema
const NoteSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    content: { type: String, required: true },
  },
  { timestamps: true, versionKey: false }
);

const Note = mongoose.model('Note', NoteSchema);

app.get('/health', (req, res) => {
  res.status(200).send({ status: "OK" });
});

// Serve images as static files
app.use("/images", express.static("images"));

// Multer configuration for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, 'images')),
  filename: (req, file, cb) => cb(null, file.originalname.replace(/\s+/g, "_")),
});
const upload = multer({ storage });

// Socket.IO connection
io.on("connection", (socket) => {
  console.log("Client connected");

  // Send all notes on connection
  Note.find().then((notes) => socket.emit("notesUpdated", notes));

  socket.on("disconnect", () => {
    console.log("Client disconnected");
  });
});

// Notify all clients about updated notes
const broadcastNotes = async () => {
  const notes = await Note.find();
  io.emit("notesUpdated", notes);
};

// API to update or create notes
app.post('/api/notes/update', async (req, res) => {
  try {
    const notes = req.body;
    await Promise.all(
      notes.map((note) =>
        Note.findOneAndUpdate({ name: note.name }, { content: note.content }, { upsert: true, new: true })
      )
    );
    await broadcastNotes();
    res.status(200).send({ message: 'Notes updated successfully' });
  } catch (error) {
    console.error('Error updating notes:', error);
    res.status(500).send({ message: 'Failed to update notes', error });
  }
});

// API to delete a note
app.post('/api/notes/delete', async (req, res) => {
  try {
    const { name } = req.body;
    const result = await Note.deleteOne({ name });
    await broadcastNotes();
    res.status(200).send({ message: result.deletedCount ? `Deleted ${name}` : `${name} not found` });
  } catch (error) {
    console.error('Error deleting note:', error);
    res.status(500).send({ message: 'Failed to delete note', error });
  }
});

// API to upload images
app.post('/api/upload-image', upload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).send({ message: 'No file uploaded' });
    res.status(200).send({ message: 'Image uploaded', fileName: req.file.filename });
  } catch (error) {
    console.error('Error uploading file:', error);
    res.status(500).send({ message: 'Image upload failed', error });
  }
});

// API to delete images
app.post('/api/delete-image', (req, res) => {
  const { name } = req.body;

  // Sanitize the name (replace spaces with underscores)
  const sanitizedName = name.replace(/\s+/g, "_");
  const filePath = path.join(__dirname, 'images', sanitizedName);

  console.log(`Attempting to delete image: ${filePath}`);

  fs.unlink(filePath, (err) => {
    if (err) {
      console.error(`Error deleting image: ${sanitizedName}`, err);
      return res.status(404).send({ message: `Failed to delete image: ${sanitizedName}` });
    }
    console.log(`Image "${sanitizedName}" deleted successfully.`);
    res.status(200).send({ message: `Image "${sanitizedName}" deleted successfully.` });
  });
});

// Start the server
const PORT = 3000;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
