const express = require('express');
const path = require('path');
const app = express();

const http = require('http').createServer(app);
const io = require('socket.io')(http);

const PORT = process.env.PORT || 3000;

// Serve static files from the "public" directory
app.use(express.static(path.join(__dirname, 'public')));

// Fallback to index.html (for SPA routing or default page)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('A user connected');

  socket.on('move', (data) => {
    socket.broadcast.emit('move', data);
  });

  socket.on('roll', (result) => {
    socket.broadcast.emit('roll', result);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

// Start the server
http.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});