const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

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
    x: (Math.random() - 0.5) * 8,
    y: 0,
    z: (Math.random() - 0.5) * 8,
    rotY: 0,
    isMoving: false,
    face: 'happy',
    topStyle: 'tshirt',
    topColor: '#3b82f6',
    bottomStyle: 'pants',
    bottomColor: '#1e293b',
    gesture: 'none'
  };

  socket.emit('currentPlayers', players);
  socket.broadcast.emit('newPlayer', players[socket.id]);

  // 프로필 및 상·하의/얼굴 변경
  socket.on('updateProfile', (data) => {
    const p = players[socket.id];
    if (!p) return;
    if (data.name && data.name.trim()) p.name = data.name.trim().substring(0, 12);
    if (data.face) p.face = data.face;
    if (data.topStyle) p.topStyle = data.topStyle;
    if (data.topColor) p.topColor = data.topColor;
    if (data.bottomStyle) p.bottomStyle = data.bottomStyle;
    if (data.bottomColor) p.bottomColor = data.bottomColor;
    io.emit('playerUpdated', p);
  });

  // 초당 50회 이상 위치 및 걷기 상태 동기화
  socket.on('playerMovement', (data) => {
    const p = players[socket.id];
    if (p) {
      p.x = data.x;
      p.y = data.y;
      p.z = data.z;
      p.rotY = data.rotY;
      p.isMoving = !!data.isMoving;
      socket.broadcast.emit('playerMoved', p);
    }
  });

  // 제스처(모션) 동기화
  socket.on('playGesture', (gestureName) => {
    const p = players[socket.id];
    if (p) {
      p.gesture = gestureName;
      io.emit('playerGesture', { id: socket.id, gesture: gestureName });
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
