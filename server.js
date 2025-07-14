const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http);

app.use(express.static("public"));

io.on("connection", socket => {
  console.log("A user connected");

  socket.on("move", pieces => {
    socket.broadcast.emit("move", pieces);
  });

  socket.on("roll", result => {
    socket.broadcast.emit("roll", result);
  });
});

http.listen(3000, () => {
  console.log("Server running at http://localhost:3000");
});
