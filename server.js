const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

app.use(express.static(__dirname));

const players = {};

io.on('connection', (socket) => {
  players[socket.id] = {
    id: socket.id,
    name: `플레이어_${socket.id.substring(0, 4)}`,
    x: (Math.random() - 0.5) * 10,
    y: 0,
    z: (Math.random() - 0.5) * 10,
    rotY: 0,
    color: Math.floor(Math.random() * 0xffffff)
  };

  socket.emit('currentPlayers', players);
  socket.broadcast.emit('newPlayer', players[socket.id]);

  socket.on('setName', (newName) => {
    if (players[socket.id] && newName.trim()) {
      players[socket.id].name = newName.trim().substring(0, 12);
      io.emit('playerUpdated', players[socket.id]);
    }
  });

  socket.on('playerMovement', (data) => {
    if (players[socket.id]) {
      players[socket.id].x = data.x;
      players[socket.id].y = data.y;
      players[socket.id].z = data.z;
      players[socket.id].rotY = data.rotY;
      socket.broadcast.emit('playerMoved', players[socket.id]);
    }
  });

  socket.on('chatMessage', (msg) => {
    if (msg && msg.trim()) {
      io.emit('chatMessage', {
        id: socket.id,
        name: players[socket.id]?.name || '익명',
        text: msg.trim().substring(0, 100)
      });
    }
  });

  socket.on('disconnect', () => {
    delete players[socket.id];
    io.emit('playerDisconnected', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});