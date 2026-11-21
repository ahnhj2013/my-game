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

// 미니게임(색깔 뒤집기) 상태 관리
const GAME_COLORS = [
  '#ef4444', '#3b82f6', '#10b981', '#f59e0b',
  '#8b5cf6', '#ec4899', '#06b6d4', '#f97316',
  '#84cc16', '#6366f1', '#14b8a6', '#e11d48',
  '#d946ef', '#0ea5e9', '#eab308', '#22c55e'
];

const GRID_SIZE = 16; // 16x16 = 256 타일
const TILE_SIZE = 2.0; // 한 칸 크기 2m (전체 32x32m)

let minigame = {
  active: false,
  type: null,
  hostId: null,
  timeLeft: 0,
  tiles: [], // 길이 256, 값: null 또는 참가자 id
  participants: {}, // id -> { id, name, color, isCpu, x, z, rotY, isMoving, dirX, dirZ, aiTimer }
  interval: null
};

function startColorFlipGame(hostId, cpuCount) {
  if (minigame.active) return;

  minigame.active = true;
  minigame.type = 'colorflip';
  minigame.hostId = hostId;
  minigame.timeLeft = 35; // 35초 라운드
  minigame.tiles = new Array(GRID_SIZE * GRID_SIZE).fill(null);
  minigame.participants = {};

  let colorIdx = 0;
  const assignColor = () => GAME_COLORS[(colorIdx++) % GAME_COLORS.length];

  // 방장 자동 참가
  if (players[hostId]) {
    players[hostId].inMinigame = true;
    minigame.participants[hostId] = {
      id: hostId,
      name: players[hostId].name,
      color: assignColor(),
      isCpu: false,
      x: (Math.random() - 0.5) * 20,
      z: (Math.random() - 0.5) * 20,
      rotY: 0,
      isMoving: false
    };
  }

  // CPU 봇 생성 (0~10명)
  const safeCpuCount = Math.max(0, Math.min(10, parseInt(cpuCount) || 0));
  for (let i = 1; i <= safeCpuCount; i++) {
    const cpuId = `cpu_${i}`;
    const angle = Math.random() * Math.PI * 2;
    minigame.participants[cpuId] = {
      id: cpuId,
      name: `CPU봇_${i}`,
      color: assignColor(),
      isCpu: true,
      x: (Math.random() - 0.5) * 22,
      z: (Math.random() - 0.5) * 22,
      rotY: angle,
      isMoving: true,
      dirX: Math.sin(angle),
      dirZ: Math.cos(angle),
      aiTimer: 1 + Math.random() * 2
    };
  }

  // 모든 클라이언트에게 미니게임 시작 & 초대 알림 전송
  io.emit('minigameInvited', {
    type: 'colorflip',
    title: '🎨 색깔 뒤집기 (Color Flip)',
    hostId: hostId,
    hostName: players[hostId]?.name || '플레이어',
    timeLeft: minigame.timeLeft,
    participants: minigame.participants,
    tiles: minigame.tiles
  });

  // 1초 타이머 & CPU AI + 타일 색칠 루프 (20Hz = 50ms)
  let secondAccum = 0;
  minigame.interval = setInterval(() => {
    if (!minigame.active) return;

    const dt = 0.05;
    secondAccum += dt;

    // CPU 움직임 업데이트
    Object.values(minigame.participants).forEach(p => {
      if (p.isCpu) {
        p.aiTimer -= dt;
        if (p.aiTimer <= 0 || Math.abs(p.x) > 14.5 || Math.abs(p.z) > 14.5) {
          // 경기장 밖으로 나가려 하면 중앙 방향으로 회전
          const targetAngle = Math.atan2(-p.x + (Math.random() - 0.5) * 16, -p.z + (Math.random() - 0.5) * 16);
          p.dirX = Math.sin(targetAngle);
          p.dirZ = Math.cos(targetAngle);
          p.rotY = targetAngle;
          p.aiTimer = 0.8 + Math.random() * 1.5;
        }
        p.x += p.dirX * 0.36;
        p.z += p.dirZ * 0.36;
        p.x = Math.max(-15, Math.min(15, p.x));
        p.z = Math.max(-15, Math.min(15, p.z));
      }

      // 참가자가 밟고 있는 타일 색칠 판정
      const col = Math.floor((p.x + (GRID_SIZE * TILE_SIZE) / 2) / TILE_SIZE);
      const row = Math.floor((p.z + (GRID_SIZE * TILE_SIZE) / 2) / TILE_SIZE);
      if (col >= 0 && col < GRID_SIZE && row >= 0 && row < GRID_SIZE) {
        const idx = row * GRID_SIZE + col;
        if (minigame.tiles[idx] !== p.id) {
          minigame.tiles[idx] = p.id;
          io.emit('tileFlipped', { index: idx, ownerId: p.id, color: p.color });
        }
      }
    });

    // CPU 위치 브로드캐스트
    io.emit('minigameCpuUpdate', minigame.participants);

    // 1초마다 남은 시간 감소 및 종료 체크
    if (secondAccum >= 1.0) {
      secondAccum = 0;
      minigame.timeLeft -= 1;
      io.emit('minigameTick', { timeLeft: minigame.timeLeft });

      if (minigame.timeLeft <= 0) {
        endColorFlipGame();
      }
    }
  }, 50);
}

function endColorFlipGame() {
  if (!minigame.active) return;
  clearInterval(minigame.interval);
  minigame.active = false;

  // 타일 개수 집계
  const counts = {};
  Object.keys(minigame.participants).forEach(id => counts[id] = 0);
  minigame.tiles.forEach(ownerId => {
    if (ownerId && counts[ownerId] !== undefined) counts[ownerId]++;
  });

  const ranking = Object.values(minigame.participants)
    .map(p => ({ id: p.id, name: p.name, color: p.color, isCpu: p.isCpu, count: counts[p.id] || 0 }))
    .sort((a, b) => b.count - a.count);

  const winner = ranking[0];
  if (winner && !winner.isCpu && players[winner.id]) {
    players[winner.id].score += 100;
  }

  // 모든 플레이어 오픈월드 복귀 상태로 전환
  Object.values(players).forEach(p => { p.inMinigame = false; });

  io.emit('minigameEnded', {
    ranking,
    winner,
    updatedPlayers: players
  });
}

io.on('connection', (socket) => {
  players[socket.id] = {
    id: socket.id,
    name: `플레이어_${socket.id.substring(0, 4)}`,
    score: 0,
    inMinigame: false,
    x: (Math.random() - 0.5) * 8,
    y: 0,
    z: (Math.random() - 0.5) * 8,
    rotY: 0,
    isMoving: false,
    face: 'happy',
    topStyle: 'tshirt',
    topColor: '#3b82f6',
    bottomStyle: 'pants',
    bottomColor: '#1e293b'
  };

  socket.emit('currentPlayers', { players, minigameActive: minigame.active });
  socket.broadcast.emit('newPlayer', players[socket.id]);

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

  socket.on('playerMovement', (data) => {
    const p = players[socket.id];
    if (p) {
      p.x = data.x;
      p.y = data.y;
      p.z = data.z;
      p.rotY = data.rotY;
      p.isMoving = !!data.isMoving;

      if (minigame.active && minigame.participants[socket.id]) {
        minigame.participants[socket.id].x = data.x;
        minigame.participants[socket.id].z = data.z;
        minigame.participants[socket.id].rotY = data.rotY;
        minigame.participants[socket.id].isMoving = p.isMoving;
      }

      socket.broadcast.emit('playerMoved', p);
    }
  });

  socket.on('playGesture', (gestureName) => {
    if (players[socket.id]) {
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

  // 미니게임 시작 요청
  socket.on('startMinigame', ({ type, cpuCount }) => {
    if (type === 'colorflip' && !minigame.active) {
      startColorFlipGame(socket.id, cpuCount);
    }
  });

  // 미니게임 초대 수락(참가) 요청
  socket.on('joinMinigame', () => {
    if (minigame.active && players[socket.id] && !minigame.participants[socket.id]) {
      const usedColors = Object.values(minigame.participants).map(p => p.color);
      const nextColor = GAME_COLORS.find(c => !usedColors.includes(c)) || GAME_COLORS[0];

      players[socket.id].inMinigame = true;
      minigame.participants[socket.id] = {
        id: socket.id,
        name: players[socket.id].name,
        color: nextColor,
        isCpu: false,
        x: (Math.random() - 0.5) * 20,
        z: (Math.random() - 0.5) * 20,
        rotY: 0,
        isMoving: false
      };

      io.emit('minigamePlayerJoined', {
        participants: minigame.participants,
        tiles: minigame.tiles,
        timeLeft: minigame.timeLeft
      });
    }
  });

  socket.on('disconnect', () => {
    delete players[socket.id];
    if (minigame.participants[socket.id]) {
      delete minigame.participants[socket.id];
    }
    io.emit('playerDisconnected', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server v1.2-20261121 running on port ${PORT}`);
});
