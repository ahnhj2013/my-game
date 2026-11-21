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

const GAME_COLORS = [
  '#ef4444', '#3b82f6', '#10b981', '#f59e0b',
  '#8b5cf6', '#ec4899', '#06b6d4', '#f97316',
  '#84cc16', '#6366f1', '#14b8a6', '#e11d48',
  '#d946ef', '#0ea5e9', '#eab308', '#22c55e'
];

const TEAM_PALETTE = [
  { name: '레드 팀', color: '#ef4444' },
  { name: '블루 팀', color: '#3b82f6' },
  { name: '그린 팀', color: '#10b981' },
  { name: '옐로우 팀', color: '#f59e0b' }
];

// 상점 가격표 (서버 검증용)
const SHOP_PRICES = {
  tops: { tshirt: 0, hoodie: 40, sweater: 50, suit: 70, uniform: 80, hanbok: 100, armor: 120, royal: 150 },
  bottoms: { pants: 0, shorts: 30, skirt: 50, jeans: 50, overalls: 70, armorpants: 110 },
  themes: { original: 0, simple: 40, cute: 60, colorful: 70, dreamy: 90, jungle: 110, cathouse: 120 }
};

const GRID_SIZE = 16;
const TILE_SIZE = 2.0;

let mg = {
  phase: 'idle', // idle | lobby | team_setup | rps | playing
  type: null,    // 'colorflip' | 'freezetag'
  hostId: null,
  cpuCount: 0,
  mode: 'solo',  // 'solo' | 'team'
  timeLeft: 0,
  participants: {}, // id -> participant obj
  tiles: [],
  teamAssignments: {}, // id -> teamIdx (0..3)
  rpsGroups: [],
  rpsPool: [],
  targetItCount: 1,
  loopTimer: null
};

function resetMinigame() {
  if (mg.loopTimer) clearInterval(mg.loopTimer);
  mg.phase = 'idle';
  mg.type = null;
  mg.hostId = null;
  mg.participants = {};
  mg.tiles = [];
  mg.teamAssignments = {};
  mg.rpsGroups = [];
  mg.rpsPool = [];
  Object.values(players).forEach(p => { p.inMinigame = false; });
}

// ==========================================
// 1. 대기실 (30초 초대) 시작
// ==========================================
function openMinigameLobby(hostId, type, cpuCount, mode) {
  if (mg.phase !== 'idle' || !players[hostId]) return;

  mg.phase = 'lobby';
  mg.type = type;
  mg.hostId = hostId;
  mg.cpuCount = Math.max(0, Math.min(10, parseInt(cpuCount) || 0));
  mg.mode = mode || 'solo';
  mg.timeLeft = 30;
  mg.participants = {};

  // 방장 자동 등록
  players[hostId].inMinigame = true;
  mg.participants[hostId] = {
    id: hostId,
    name: players[hostId].name,
    isCpu: false
  };

  io.emit('minigameLobbyStarted', {
    type: mg.type,
    title: type === 'colorflip' ? '🎨 색깔 뒤집기 (1분)' : '🧊 얼음땡 (3분)',
    hostId: hostId,
    hostName: players[hostId].name,
    mode: mg.mode,
    cpuCount: mg.cpuCount,
    timeLeft: mg.timeLeft,
    participants: mg.participants
  });

  mg.loopTimer = setInterval(() => {
    mg.timeLeft -= 1;
    io.emit('minigameLobbyTick', {
      timeLeft: mg.timeLeft,
      participants: mg.participants
    });

    if (mg.timeLeft <= 0) {
      clearInterval(mg.loopTimer);
      onLobbyFinished();
    }
  }, 1000);
}

function onLobbyFinished() {
  // 설정한 수만큼 CPU 참가자 합류
  for (let i = 1; i <= mg.cpuCount; i++) {
    const cpuId = `cpu_${i}`;
    mg.participants[cpuId] = {
      id: cpuId,
      name: `CPU봇_${i}`,
      isCpu: true
    };
  }

  const allList = Object.values(mg.participants);

  if (mg.type === 'colorflip') {
    if (mg.mode === 'team') {
      // 방장에게 팀 개수 및 팀원 배정 화면 오픈
      mg.phase = 'team_setup';
      allList.forEach((p, idx) => { mg.teamAssignments[p.id] = idx % 2; });
      io.emit('colorflipTeamSetup', {
        hostId: mg.hostId,
        participants: mg.participants,
        assignments: mg.teamAssignments
      });
    } else {
      startColorFlipMatch(1, {});
    }
  } else if (mg.type === 'freezetag') {
    // 총 5명 미만이면 취소 후 재시도 안내
    if (allList.length < 5) {
      io.emit('minigameCancelled', {
        reason: `얼음땡은 총 5명 이상이어야 시작할 수 있습니다! (현재 ${allList.length}명) 다시 모집해 주세요.`
      });
      resetMinigame();
      return;
    }
    startRpsTournament();
  }
}

// ==========================================
// 2. 미니게임 1: 색깔 뒤집기 (60초)
// ==========================================
function startColorFlipMatch(teamCount, assignments) {
  mg.phase = 'playing';
  mg.timeLeft = 60; // 1분
  mg.tiles = new Array(GRID_SIZE * GRID_SIZE).fill(null);

  const list = Object.values(mg.participants);
  list.forEach((p, idx) => {
    let color = GAME_COLORS[idx % GAME_COLORS.length];
    let teamIdx = null;
    if (mg.mode === 'team') {
      teamIdx = (assignments[p.id] !== undefined) ? parseInt(assignments[p.id]) : (idx % teamCount);
      color = TEAM_PALETTE[teamIdx % TEAM_PALETTE.length].color;
    }

    const angle = Math.random() * Math.PI * 2;
    p.color = color;
    p.teamIdx = teamIdx;
    p.x = (Math.random() - 0.5) * 22;
    p.z = (Math.random() - 0.5) * 22;
    p.rotY = angle;
    p.isMoving = p.isCpu;
    p.dirX = Math.sin(angle);
    p.dirZ = Math.cos(angle);
    p.aiTimer = 1 + Math.random() * 1.5;
  });

  io.emit('colorflipMatchStarted', {
    mode: mg.mode,
    teamCount,
    timeLeft: mg.timeLeft,
    participants: mg.participants,
    tiles: mg.tiles
  });

  let secAccum = 0;
  mg.loopTimer = setInterval(() => {
    if (mg.phase !== 'playing') return;
    const dt = 0.05;
    secAccum += dt;

    Object.values(mg.participants).forEach(p => {
      if (p.isCpu) {
        p.aiTimer -= dt;
        if (p.aiTimer <= 0 || Math.abs(p.x) > 14.5 || Math.abs(p.z) > 14.5) {
          const targetAngle = Math.atan2(-p.x + (Math.random() - 0.5) * 18, -p.z + (Math.random() - 0.5) * 18);
          p.dirX = Math.sin(targetAngle);
          p.dirZ = Math.cos(targetAngle);
          p.rotY = targetAngle;
          p.aiTimer = 0.7 + Math.random() * 1.4;
        }
        p.x = Math.max(-15, Math.min(15, p.x + p.dirX * 0.36));
        p.z = Math.max(-15, Math.min(15, p.z + p.dirZ * 0.36));
      }

      const col = Math.floor((p.x + (GRID_SIZE * TILE_SIZE) / 2) / TILE_SIZE);
      const row = Math.floor((p.z + (GRID_SIZE * TILE_SIZE) / 2) / TILE_SIZE);
      if (col >= 0 && col < GRID_SIZE && row >= 0 && row < GRID_SIZE) {
        const idx = row * GRID_SIZE + col;
        const ownerKey = (mg.mode === 'team') ? `team_${p.teamIdx}` : p.id;
        if (mg.tiles[idx] !== ownerKey) {
          mg.tiles[idx] = ownerKey;
          io.emit('tileFlipped', { index: idx, ownerKey, color: p.color });
        }
      }
    });

    io.emit('minigameActorsUpdate', mg.participants);

    if (secAccum >= 1.0) {
      secAccum = 0;
      mg.timeLeft -= 1;

      // 실시간 점수판 집계
      const scoreboard = computeColorFlipScores();
      io.emit('colorflipTick', { timeLeft: mg.timeLeft, scoreboard });

      if (mg.timeLeft <= 0) {
        finishColorFlipMatch();
      }
    }
  }, 50);
}

function computeColorFlipScores() {
  if (mg.mode === 'team') {
    const teamCounts = {};
    mg.tiles.forEach(ownerKey => {
      if (ownerKey) teamCounts[ownerKey] = (teamCounts[ownerKey] || 0) + 1;
    });
    const usedTeams = [...new Set(Object.values(mg.participants).map(p => p.teamIdx))];
    return usedTeams.map(tIdx => ({
      key: `team_${tIdx}`,
      teamIdx: tIdx,
      name: TEAM_PALETTE[tIdx]?.name || `${tIdx + 1}팀`,
      color: TEAM_PALETTE[tIdx]?.color || '#fff',
      count: teamCounts[`team_${tIdx}`] || 0
    })).sort((a, b) => b.count - a.count);
  } else {
    const counts = {};
    mg.tiles.forEach(id => { if (id) counts[id] = (counts[id] || 0) + 1; });
    return Object.values(mg.participants).map(p => ({
      key: p.id,
      id: p.id,
      name: p.name,
      color: p.color,
      isCpu: p.isCpu,
      count: counts[p.id] || 0
    })).sort((a, b) => b.count - a.count);
  }
}

function finishColorFlipMatch() {
  const scoreboard = computeColorFlipScores();
  const top = scoreboard[0];
  let summaryText = '';

  if (mg.mode === 'team' && top) {
    Object.values(mg.participants).forEach(p => {
      if (p.teamIdx === top.teamIdx && !p.isCpu && players[p.id]) {
        players[p.id].mong += 100;
      }
    });
    summaryText = `우승 팀: ${top.name} (${top.count}칸) — 모둠 전원 +100몽 지급!`;
  } else if (top) {
    if (!top.isCpu && players[top.id]) {
      players[top.id].mong += 100;
    }
    summaryText = `1등 우승: ${top.name} (${top.count}칸) — +100몽 지급!`;
  }

  io.emit('minigameEnded', {
    title: '🎨 색깔 뒤집기 결과',
    summaryText,
    scoreboard,
    updatedPlayers: players
  });
  resetMinigame();
}

// ==========================================
// 3. 미니게임 2: 얼음땡 (가위바위보 토너먼트 -> 3분 본게임)
// ==========================================
function startRpsTournament() {
  mg.phase = 'rps';
  const allIds = Object.keys(mg.participants);
  // 전체 인원의 10~15% (최소 1명)
  mg.targetItCount = Math.max(1, Math.round(allIds.length * 0.13));
  mg.rpsPool = [...allIds];
  runRpsRound();
}

function runRpsRound() {
  // 패배자 풀이 목표 술래 수 이하가 되면 토너먼트 종료 및 술래 확정
  if (mg.rpsPool.length <= mg.targetItCount) {
    const itIds = mg.rpsPool.slice(0, mg.targetItCount);
    // 혹시 동점으로 풀이 적게 남았을 경우 전체에서 보충
    if (itIds.length < mg.targetItCount) {
      const others = Object.keys(mg.participants).filter(id => !itIds.includes(id));
      while (itIds.length < mg.targetItCount && others.length > 0) {
        itIds.push(others.shift());
      }
    }
    startFreezeTagMatch(itIds);
    return;
  }

  // 3명씩 조 편성 (남은 인원이 4명이면 2명/2명, 2명이면 2명 1조)
  const shuffled = [...mg.rpsPool].sort(() => Math.random() - 0.5);
  const groups = [];
  let i = 0;
  while (i < shuffled.length) {
    const rem = shuffled.length - i;
    if (rem === 4) {
      groups.push(shuffled.slice(i, i + 2));
      groups.push(shuffled.slice(i + 2, i + 4));
      break;
    } else if (rem <= 3) {
      groups.push(shuffled.slice(i));
      break;
    } else {
      groups.push(shuffled.slice(i, i + 3));
      i += 3;
    }
  }

  mg.rpsGroups = groups.map((memberIds, idx) => {
    const choices = {};
    memberIds.forEach(id => {
      if (mg.participants[id]?.isCpu) {
        const opts = ['rock', 'paper', 'scissors'];
        choices[id] = opts[Math.floor(Math.random() * 3)];
      }
    });
    return { groupIdx: idx, memberIds, choices };
  });

  io.emit('rpsRoundStarted', {
    targetItCount: mg.targetItCount,
    groups: mg.rpsGroups,
    participants: mg.participants,
    timeLeft: 10
  });

  let rpsTimer = 10;
  mg.loopTimer = setInterval(() => {
    rpsTimer -= 1;
    io.emit('rpsTick', { timeLeft: rpsTimer });

    const allChosen = mg.rpsGroups.every(g => g.memberIds.every(id => g.choices[id]));
    if (allChosen || rpsTimer <= 0) {
      clearInterval(mg.loopTimer);
      resolveRpsRound();
    }
  }, 1000);
}

function getRpsLosers(memberIds, choices) {
  const opts = ['rock', 'paper', 'scissors'];
  memberIds.forEach(id => {
    if (!choices[id]) choices[id] = opts[Math.floor(Math.random() * 3)];
  });

  const uniqueMoves = [...new Set(memberIds.map(id => choices[id]))];
  // 모두 같은 걸 내거나 3가지가 다 나오면 무승부 -> 전원 재대결 후보
  if (uniqueMoves.length === 1 || uniqueMoves.length === 3) {
    return [...memberIds];
  }

  // 2가지 손모양만 나온 경우 진 쪽 판별
  const [m1, m2] = uniqueMoves;
  const m1BeatsM2 = (m1 === 'rock' && m2 === 'scissors') || (m1 === 'scissors' && m2 === 'paper') || (m1 === 'paper' && m2 === 'rock');
  const losingMove = m1BeatsM2 ? m2 : m1;
  return memberIds.filter(id => choices[id] === losingMove);
}

function resolveRpsRound() {
  const nextPool = [];
  mg.rpsGroups.forEach(g => {
    const losers = getRpsLosers(g.memberIds, g.choices);
    nextPool.push(...losers);
  });

  io.emit('rpsRoundResult', {
    groups: mg.rpsGroups,
    losers: nextPool,
    participants: mg.participants
  });

  mg.rpsPool = nextPool;
  setTimeout(() => {
    if (mg.phase === 'rps') runRpsRound();
  }, 2200);
}

function startFreezeTagMatch(itIds) {
  mg.phase = 'playing';
  mg.timeLeft = 180; // 3분

  Object.values(mg.participants).forEach(p => {
    const isIt = itIds.includes(p.id);
    p.role = isIt ? 'it' : 'runner';
    p.status = 'normal'; // 'normal' | 'frozen' | 'out'
    p.x = isIt ? (Math.random() - 0.5) * 6 : (Math.random() > 0.5 ? 1 : -1) * (10 + Math.random() * 6);
    p.z = isIt ? (Math.random() - 0.5) * 6 : (Math.random() > 0.5 ? 1 : -1) * (10 + Math.random() * 6);
    p.rotY = Math.random() * Math.PI * 2;
    p.isMoving = p.isCpu;
    p.dirX = Math.sin(p.rotY);
    p.dirZ = Math.cos(p.rotY);
    p.aiTimer = 1;
    p.freezeCooldown = 0;
  });

  io.emit('freezetagMatchStarted', {
    timeLeft: mg.timeLeft,
    participants: mg.participants
  });

  let secAccum = 0;
  mg.loopTimer = setInterval(() => {
    if (mg.phase !== 'playing') return;
    const dt = 0.05;
    secAccum += dt;

    const allP = Object.values(mg.participants);
    const its = allP.filter(p => p.role === 'it');
    const runners = allP.filter(p => p.role === 'runner');

    // CPU AI 행동 로직
    allP.forEach(p => {
      if (p.freezeCooldown > 0) p.freezeCooldown = Math.max(0, p.freezeCooldown - dt);
      if (!p.isCpu) return;

      if (p.role === 'it') {
        // 술래 CPU: 잡을 수 있는(normal) 도망자 추적
        const targets = runners.filter(r => r.status === 'normal');
        if (targets.length > 0) {
          targets.sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z));
          const t = targets[0];
          const ang = Math.atan2(t.x - p.x, t.z - p.z);
          p.rotY = ang;
          p.x += Math.sin(ang) * 0.25;
          p.z += Math.cos(ang) * 0.25;
          p.isMoving = true;
        }
      } else {
        // 도망자 CPU
        if (p.status === 'frozen' || p.status === 'out') {
          p.isMoving = false;
          return;
        }
        p.isMoving = true;
        // 가까운 술래가 3.2m 이내로 접근하면 얼음 사용
        const nearIt = its.find(it => Math.hypot(it.x - p.x, it.z - p.z) < 3.2);
        if (nearIt && p.freezeCooldown <= 0) {
          p.status = 'frozen';
          p.isMoving = false;
          io.emit('freezetagAction', { type: 'freeze', actorId: p.id, targetId: p.id, participants: mg.participants });
          return;
        }
        // 얼음 된 동료가 있으면 구하러 이동
        const frozenMate = runners.find(r => r.status === 'frozen');
        if (frozenMate) {
          const dist = Math.hypot(frozenMate.x - p.x, frozenMate.z - p.z);
          const ang = Math.atan2(frozenMate.x - p.x, frozenMate.z - p.z);
          p.rotY = ang;
          p.x += Math.sin(ang) * 0.23;
          p.z += Math.cos(ang) * 0.23;
          if (dist < 2.2) {
            frozenMate.status = 'normal';
            frozenMate.freezeCooldown = 2.0;
            io.emit('freezetagAction', { type: 'fire', actorId: p.id, targetId: frozenMate.id, participants: mg.participants });
          }
        } else {
          // 자유 이동
          p.aiTimer -= dt;
          if (p.aiTimer <= 0 || Math.abs(p.x) > 17 || Math.abs(p.z) > 17) {
            const ang = Math.atan2(-p.x + (Math.random() - 0.5) * 20, -p.z + (Math.random() - 0.5) * 20);
            p.dirX = Math.sin(ang); p.dirZ = Math.cos(ang); p.rotY = ang;
            p.aiTimer = 1 + Math.random() * 1.5;
          }
          p.x = Math.max(-18, Math.min(18, p.x + p.dirX * 0.22));
          p.z = Math.max(-18, Math.min(18, p.z + p.dirZ * 0.22));
        }
      }
    });

    // 술래의 도망자 터치(아웃) 판정
    its.forEach(it => {
      runners.forEach(r => {
        if (r.status === 'normal' && Math.hypot(it.x - r.x, it.z - r.z) < 1.5) {
          r.status = 'out';
          r.isMoving = false;
          if (!r.isCpu && players[r.id]) {
            players[r.id].mong = Math.max(0, players[r.id].mong - 10);
          }
          io.emit('freezetagAction', {
            type: 'out',
            actorId: it.id,
            targetId: r.id,
            participants: mg.participants,
            updatedPlayers: players
          });
        }
      });
    });

    io.emit('minigameActorsUpdate', mg.participants);

    // 승리 조건 1: 모든 도망자가 얼음이거나 아웃된 경우 술래 즉시 승리
    const activeRunners = runners.filter(r => r.status === 'normal');
    if (activeRunners.length === 0) {
      finishFreezeTagMatch(true);
      return;
    }

    if (secAccum >= 1.0) {
      secAccum = 0;
      mg.timeLeft -= 1;
      io.emit('freezetagTick', {
        timeLeft: mg.timeLeft,
        normalCount: activeRunners.length,
        frozenCount: runners.filter(r => r.status === 'frozen').length,
        outCount: runners.filter(r => r.status === 'out').length
      });

      if (mg.timeLeft <= 0) {
        finishFreezeTagMatch(false);
      }
    }
  }, 50);
}

function finishFreezeTagMatch(itsWon) {
  const allP = Object.values(mg.participants);
  let summaryText = '';

  if (itsWon) {
    allP.forEach(p => {
      if (p.role === 'it' && !p.isCpu && players[p.id]) {
        players[p.id].mong += 200;
      }
    });
    summaryText = '👹 술래 팀 승리! 제한시간 내 전원 얼음/아웃 성공 — 술래 전원 +200몽!';
  } else {
    allP.forEach(p => {
      if (p.role === 'runner' && !p.isCpu && players[p.id]) {
        if (p.status === 'normal' || p.status === 'frozen') players[p.id].mong += 200;
        else if (p.status === 'out') players[p.id].mong += 100;
      }
    });
    summaryText = '🏃 도망자 팀 승리! 생존·얼음 상태 +200몽 / 아웃된 참가자 +100몽 지급!';
  }

  io.emit('minigameEnded', {
    title: '🧊 얼음땡 최종 결과',
    summaryText,
    scoreboard: [],
    updatedPlayers: players
  });
  resetMinigame();
}

// ==========================================
// 4. 소켓 이벤트 핸들러
// ==========================================
io.on('connection', (socket) => {
  players[socket.id] = {
    id: socket.id,
    name: `플레이어_${socket.id.substring(0, 4)}`,
    mong: 200, // 기본 시작 자금 200몽
    speedLevel: 0, // 0~5
    jumpLevel: 0,  // 0~5
    ownedTops: ['tshirt'],
    ownedBottoms: ['pants'],
    ownedThemes: ['original'],
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

  socket.emit('currentPlayers', { players });
  socket.broadcast.emit('newPlayer', players[socket.id]);

  socket.on('updateProfile', (data) => {
    const p = players[socket.id];
    if (!p) return;
    if (data.name && data.name.trim()) p.name = data.name.trim().substring(0, 12);
    if (data.face) p.face = data.face;
    if (data.topStyle && p.ownedTops.includes(data.topStyle)) p.topStyle = data.topStyle;
    if (data.topColor) p.topColor = data.topColor;
    if (data.bottomStyle && p.ownedBottoms.includes(data.bottomStyle)) p.bottomStyle = data.bottomStyle;
    if (data.bottomColor) p.bottomColor = data.bottomColor;
    io.emit('playerUpdated', p);
  });

  // 상점 구매 및 능력치 강화 (몽 차감)
  socket.on('buyItem', ({ category, itemId }) => {
    const p = players[socket.id];
    if (!p) return;

    if (category === 'speed') {
      if (p.speedLevel >= 5) return;
      const cost = (p.speedLevel + 1) * 50;
      if (p.mong >= cost) {
        p.mong -= cost;
        p.speedLevel += 1;
        socket.emit('shopUpdated', p);
      }
    } else if (category === 'jump') {
      if (p.jumpLevel >= 5) return;
      const cost = (p.jumpLevel + 1) * 50;
      if (p.mong >= cost) {
        p.mong -= cost;
        p.jumpLevel += 1;
        socket.emit('shopUpdated', p);
      }
    } else if (category === 'top') {
      const cost = SHOP_PRICES.tops[itemId] ?? 9999;
      if (!p.ownedTops.includes(itemId) && p.mong >= cost) {
        p.mong -= cost;
        p.ownedTops.push(itemId);
        p.topStyle = itemId;
        socket.emit('shopUpdated', p);
        io.emit('playerUpdated', p);
      }
    } else if (category === 'bottom') {
      const cost = SHOP_PRICES.bottoms[itemId] ?? 9999;
      if (!p.ownedBottoms.includes(itemId) && p.mong >= cost) {
        p.mong -= cost;
        p.ownedBottoms.push(itemId);
        p.bottomStyle = itemId;
        socket.emit('shopUpdated', p);
        io.emit('playerUpdated', p);
      }
    } else if (category === 'theme') {
      const cost = SHOP_PRICES.themes[itemId] ?? 9999;
      if (!p.ownedThemes.includes(itemId) && p.mong >= cost) {
        p.mong -= cost;
        p.ownedThemes.push(itemId);
        socket.emit('shopUpdated', p);
      }
    }
  });

  socket.on('playerMovement', (data) => {
    const p = players[socket.id];
    if (!p) return;
    p.x = data.x; p.y = data.y; p.z = data.z;
    p.rotY = data.rotY; p.isMoving = !!data.isMoving;

    if (mg.phase === 'playing' && mg.participants[socket.id]) {
      const mp = mg.participants[socket.id];
      if (mg.type === 'freezetag' && (mp.status === 'frozen' || mp.status === 'out')) {
        mp.isMoving = false;
      } else {
        mp.x = data.x; mp.z = data.z; mp.rotY = data.rotY; mp.isMoving = p.isMoving;
      }
    }
    socket.broadcast.emit('playerMoved', p);
  });

  socket.on('playGesture', (gestureName) => {
    if (players[socket.id] && mg.phase !== 'playing') {
      io.emit('playerGesture', { id: socket.id, gesture: gestureName });
    }
  });
