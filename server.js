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

const SHOP_PRICES = {
  tops: { tshirt: 0, hoodie: 40, sweater: 50, suit: 70, uniform: 80, hanbok: 100, armor: 120, royal: 150 },
  bottoms: { pants: 0, shorts: 30, skirt: 50, jeans: 50, overalls: 70, armorpants: 110 },
  themes: { original: 0, simple: 40, cute: 60, colorful: 70, dreamy: 90, jungle: 110, cathouse: 120 }
};

// 거짓말 탐지기(라이어 게임) 제시어 쌍 [시민 제시어, 라이어 제시어, CPU 힌트 풀]
const LIAR_TOPICS = [
  { category: '음식', citizen: '짜장면', liar: '짬뽕', citizenHints: ['면발이 쫄깃하고 달콤짭짤해요', '검은 소스가 특징인 국민 배달음식이에요', '단무지랑 같이 먹으면 최고예요'], liarHints: ['면 요리인데 국물이나 소스가 진해요', '중국집에서 자주 시켜 먹는 메뉴예요', '양파랑 해산물이나 고기가 들어가요'] },
  { category: '동물', citizen: '강아지', liar: '고양이', citizenHints: ['꼬리를 흔들며 주인을 반겨줘요', '산책을 정말 좋아하는 반려동물이에요', '멍멍 짖으면서 애교를 부려요'], liarHints: ['털이 보들보들하고 귀여운 반려동물이에요', '집에서 키우는 사람들이 아주 많아요', '발소리가 조용하고 낮잠을 좋아해요'] },
  { category: '스포츠', citizen: '축구', liar: '농구', citizenHints: ['발로 공을 차서 골대에 넣는 경기예요', '월드컵에서 가장 인기 있는 종목이에요', '11명이 한 팀을 이뤄 넓은 잔디에서 뛰어요'], liarHints: ['공을 골대에 넣어야 점수가 올라가요', '팀워크와 패스가 정말 중요한 구기 종목이에요', '전 세계적으로 프로 리그가 아주 인기가 많아요'] },
  { category: '교통수단', citizen: '비행기', liar: '기차', citizenHints: ['하늘 높이 구름 위를 날아다녀요', '해외여행 갈 때 꼭 타야 하는 탈것이에요', '공항에서 탑승 수속을 밟고 타요'], liarHints: ['먼 거리를 빠르게 이동할 때 이용해요', '창밖 풍경을 보면서 여행하는 기분이 나요', '정해진 시간표대로 출발하고 도착해요'] },
  { category: '과일', citizen: '사과', liar: '배', citizenHints: ['빨간 껍질에 아삭아삭한 식감이 좋아요', '백설공주 이야기에도 나오는 과일이에요', '아침에 먹으면 건강에 좋다고 해요'], liarHints: ['아삭아삭 씹히는 식감이 시원하고 달콤해요', '껍질을 깎아서 조각내어 먹는 과일이에요', '추석 같은 명절 선물로도 인기가 많아요'] },
  { category: '계절', citizen: '여름', liar: '겨울', citizenHints: ['해수욕장에 가서 물놀이하기 딱 좋아요', '아이스크림이랑 수박이 생각나는 계절이에요', '날씨가 덥고 방학이 있어서 신나요'], liarHints: ['방학이 있어서 여행 가기 좋은 계절이에요', '특정 스포츠나 계절 음식이 뚜렷하게 떠올라요', '날씨 변화가 뚜렷해서 옷차림이 확 달라져요'] },
  { category: '악기', citizen: '피아노', liar: '바이올린', citizenHints: ['흰 건반과 검은 건반을 손가락으로 눌러요', '클래식 연주회에서 가장 기본이 되는 악기예요', '양손으로 화음과 멜로디를 동시에 연주해요'], liarHints: ['클래식 오케스트라에서 아름다운 선율을 연주해요', '어릴 때부터 학원에서 많이 배우는 악기예요', '연습을 많이 해야 음정이 정확하게 나와요'] }
];

const GRID_SIZE = 16;
const TILE_SIZE = 2.0;

let mg = {
  phase: 'idle', // idle | lobby | team_setup | rps | playing | liar_speak | liar_vote
  type: null,    // 'colorflip' | 'freezetag' | 'liar'
  hostId: null,
  cpuCount: 0,
  mode: 'solo',
  timeLeft: 0,
  participants: {},
  tiles: [],
  teamAssignments: {},
  arenaHalfSize: 19,
  rpsGroups: [],
  rpsPool: [],
  targetItCount: 1,
  // 라이어 게임 전용
  liarId: null,
  liarTopic: null,
  turnOrder: [],
  turnIndex: 0,
  roundNum: 1,
  speeches: [],
  votes: {},
  runoffIds: null,
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
  mg.liarId = null;
  mg.liarTopic = null;
  mg.turnOrder = [];
  mg.speeches = [];
  mg.votes = {};
  mg.runoffIds = null;
  Object.values(players).forEach(p => { p.inMinigame = false; });
}

// ==========================================
// 1. 대기실 (30초 모집 + 방장 즉시 시작 가능)
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

  players[hostId].inMinigame = true;
  mg.participants[hostId] = {
    id: hostId,
    name: players[hostId].name,
    isCpu: false
  };

  const titleMap = {
    colorflip: '🎨 색깔 뒤집기 (1분)',
    freezetag: '🧊 얼음땡 (3분 / 최소 5명)',
    liar: '🕵️ 거짓말 탐지기 (최소 4명)'
  };

  io.emit('minigameLobbyStarted', {
    type: mg.type,
    title: titleMap[type] || type,
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
  if (mg.phase !== 'lobby') return;
  if (mg.loopTimer) clearInterval(mg.loopTimer);

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
    if (allList.length < 5) {
      io.emit('minigameCancelled', {
        reason: `얼음땡은 총 5명 이상이어야 시작할 수 있습니다! (현재 ${allList.length}명) 다시 모집해 주세요.`
      });
      resetMinigame();
      return;
    }
    startRpsTournament();
  } else if (mg.type === 'liar') {
    if (allList.length < 4) {
      io.emit('minigameCancelled', {
        reason: `거짓말 탐지기는 총 4명 이상이어야 시작할 수 있습니다! (현재 ${allList.length}명) 다시 모집해 주세요.`
      });
      resetMinigame();
      return;
    }
    startLiarGame();
  }
}

// ==========================================
// 2. 미니게임 1: 색깔 뒤집기 (60초 / 팀복 자동 변경)
// ==========================================
function startColorFlipMatch(teamCount, assignments) {
  mg.phase = 'playing';
  mg.timeLeft = 60;
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
    mg.tiles.forEach(ownerKey => { if (ownerKey) teamCounts[ownerKey] = (teamCounts[ownerKey] || 0) + 1; });
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
      key: p.id, id: p.id, name: p.name, color: p.color, isCpu: p.isCpu,
      count: counts[p.id] || 0
    })).sort((a, b) => b.count - a.count);
  }
}

function finishColorFlipMatch() {
  if (mg.loopTimer) clearInterval(mg.loopTimer);
  const scoreboard = computeColorFlipScores();
  const top = scoreboard[0];
  let summaryText = '';

  if (mg.mode === 'team' && top) {
    Object.values(mg.participants).forEach(p => {
      if (p.teamIdx === top.teamIdx && !p.isCpu && players[p.id]) {
        players[p.id].mong = (players[p.id].mong || 0) + 100;
      }
    });
    summaryText = `우승 팀: ${top.name} (${top.count}칸) — 모둠 전원 +100몽 지급!`;
  } else if (top) {
    if (!top.isCpu && players[top.id]) {
      players[top.id].mong = (players[top.id].mong || 0) + 100;
    }
    summaryText = `1등 우승: ${top.name} (${top.count}칸) — +100몽 지급!`;
  }

  io.emit('minigameEnded', {
    title: '🎨 색깔 뒤집기 결과',
    summaryText,
    updatedPlayers: players
  });
  resetMinigame();
}

// ==========================================
// 3. 미니게임 2: 얼음땡 (가위바위보 -> 동적 확장 경기장 & 관중석)
// ==========================================
function startRpsTournament() {
  mg.phase = 'rps';
  const allIds = Object.keys(mg.participants);
  mg.targetItCount = Math.max(1, Math.round(allIds.length * 0.13));
  mg.rpsPool = [...allIds];
  runRpsRound();
}

function runRpsRound() {
  if (mg.rpsPool.length <= mg.targetItCount) {
    const itIds = mg.rpsPool.slice(0, mg.targetItCount);
    if (itIds.length < mg.targetItCount) {
      const others = Object.keys(mg.participants).filter(id => !itIds.includes(id));
      while (itIds.length < mg.targetItCount && others.length > 0) {
        itIds.push(others.shift());
      }
    }
    startFreezeTagMatch(itIds);
    return;
  }

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
  if (uniqueMoves.length === 1 || uniqueMoves.length === 3) return [...memberIds];

  const [m1, m2] = uniqueMoves;
  const m1BeatsM2 = (m1 === 'rock' && m2 === 'scissors') || (m1 === 'scissors' && m2 === 'paper') || (m1 === 'paper' && m2 === 'rock');
  const losingMove = m1BeatsM2 ? m2 : m1;
  return memberIds.filter(id => choices[id] === losingMove);
}

function resolveRpsRound() {
  const nextPool = [];
  mg.rpsGroups.forEach(g => {
    nextPool.push(...getRpsLosers(g.memberIds, g.choices));
  });

  io.emit('rpsRoundResult', {
    losers: nextPool,
    participants: mg.participants
  });

  mg.rpsPool = nextPool;
  setTimeout(() => {
    if (mg.phase === 'rps') runRpsRound();
  }, 2000);
}

function startFreezeTagMatch(itIds) {
  mg.phase = 'playing';
  mg.timeLeft = 180; // 3분

  const count = Object.keys(mg.participants).length;
  // 인원이 많을수록 경기장 반경 자동 확장 (최소 19m ~ 최대 33m)
  mg.arenaHalfSize = Math.min(33, 18 + Math.floor(count * 1.1));
  const spawnLim = mg.arenaHalfSize - 2.5;

  Object.values(mg.participants).forEach(p => {
    const isIt = itIds.includes(p.id);
    p.role = isIt ? 'it' : 'runner';
    p.status = 'normal'; // normal | frozen | out
    p.x = isIt ? (Math.random() - 0.5) * 5 : (Math.random() > 0.5 ? 1 : -1) * (spawnLim * 0.55 + Math.random() * (spawnLim * 0.35));
    p.y = 0;
    p.z = isIt ? (Math.random() - 0.5) * 5 : (Math.random() > 0.5 ? 1 : -1) * (spawnLim * 0.55 + Math.random() * (spawnLim * 0.35));
    p.rotY = Math.random() * Math.PI * 2;
    p.isMoving = p.isCpu;
    p.dirX = Math.sin(p.rotY);
    p.dirZ = Math.cos(p.rotY);
    p.aiTimer = 1;
    p.freezeCooldown = 0;
  });

  io.emit('freezetagMatchStarted', {
    timeLeft: mg.timeLeft,
    arenaHalfSize: mg.arenaHalfSize,
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
    const lim = mg.arenaHalfSize - 1.0;

    allP.forEach(p => {
      if (p.freezeCooldown > 0) p.freezeCooldown = Math.max(0, p.freezeCooldown - dt);
      if (!p.isCpu) return;

      if (p.role === 'it') {
        const targets = runners.filter(r => r.status === 'normal');
        if (targets.length > 0) {
          targets.sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z));
          const t = targets[0];
          const ang = Math.atan2(t.x - p.x, t.z - p.z);
          p.rotY = ang;
          p.x = Math.max(-lim, Math.min(lim, p.x + Math.sin(ang) * 0.25));
          p.z = Math.max(-lim, Math.min(lim, p.z + Math.cos(ang) * 0.25));
          p.isMoving = true;
        }
      } else {
        if (p.status === 'frozen' || p.status === 'out') {
          p.isMoving = false;
          return;
        }
        p.isMoving = true;
        const nearIt = its.find(it => Math.hypot(it.x - p.x, it.z - p.z) < 3.2);
        if (nearIt && p.freezeCooldown <= 0) {
          p.status = 'frozen';
          p.isMoving = false;
          io.emit('freezetagAction', { type: 'freeze', actorId: p.id, targetId: p.id, participants: mg.participants });
          return;
        }
        const frozenMate = runners.find(r => r.status === 'frozen');
        if (frozenMate) {
          const dist = Math.hypot(frozenMate.x - p.x, frozenMate.z - p.z);
          const ang = Math.atan2(frozenMate.x - p.x, frozenMate.z - p.z);
          p.rotY = ang;
          p.x = Math.max(-lim, Math.min(lim, p.x + Math.sin(ang) * 0.23));
          p.z = Math.max(-lim, Math.min(lim, p.z + Math.cos(ang) * 0.23));
          if (dist < 2.3) {
            frozenMate.status = 'normal';
            frozenMate.freezeCooldown = 2.0;
            io.emit('freezetagAction', { type: 'fire', actorId: p.id, targetId: frozenMate.id, participants: mg.participants });
          }
        } else {
          p.aiTimer -= dt;
          if (p.aiTimer <= 0 || Math.abs(p.x) > lim - 1 || Math.abs(p.z) > lim - 1) {
            const ang = Math.atan2(-p.x + (Math.random() - 0.5) * lim, -p.z + (Math.random() - 0.5) * lim);
            p.dirX = Math.sin(ang); p.dirZ = Math.cos(ang); p.rotY = ang;
            p.aiTimer = 1 + Math.random() * 1.5;
          }
          p.x = Math.max(-lim, Math.min(lim, p.x + p.dirX * 0.22));
          p.z = Math.max(-lim, Math.min(lim, p.z + p.dirZ * 0.22));
        }
      }
    });

    // 술래의 도망자 잡기(아웃) 판정 -> 월드컵 관중석으로 이동
    its.forEach(it => {
      runners.forEach(r => {
        if (r.status === 'normal' && Math.hypot(it.x - r.x, it.z - r.z) < 1.55) {
          r.status = 'out';
          r.isMoving = false;
          // 경기장 바깥 월드컵 관중석 좌표 배치
          r.x = (Math.random() - 0.5) * 14;
          r.y = 4.5;
          r.z = -(mg.arenaHalfSize + 4.5);
          r.rotY = 0;

          if (!r.isCpu && players[r.id]) {
            players[r.id].mong = Math.max(0, (players[r.id].mong || 0) - 10);
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

    // 승리 조건: 도망자 중 'normal'(움직이는 사람)이 0명이면(모두 얼음 또는 아웃) 술래 승리!
    const activeRunners = runners.filter(r => r.status === 'normal');
    if (activeRunners.length === 0) {
      finishFreezeTagMatch(true);
      return;
    }

    if (secAccum >= 1.0) {
      secAccum = 0;
      mg.timeLeft -= 1;
      io.emit('freezetagTick', { timeLeft: mg.timeLeft });

      if (mg.timeLeft <= 0) {
        finishFreezeTagMatch(false);
      }
    }
  }, 50);
}

function finishFreezeTagMatch(itsWon) {
  if (mg.loopTimer) clearInterval(mg.loopTimer);
  const allP = Object.values(mg.participants);
  let summaryText = '';

  if (itsWon) {
    allP.forEach(p => {
      if (p.role === 'it' && !p.isCpu && players[p.id]) {
        players[p.id].mong = (players[p.id].mong || 0) + 200;
      }
    });
    summaryText = '👹 술래 팀 승리! 전원 얼음/아웃 성공 — 술래 전원 +200몽 지급!';
  } else {
    allP.forEach(p => {
      if (p.role === 'runner' && !p.isCpu && players[p.id]) {
        if (p.status === 'normal' || p.status === 'frozen') {
          players[p.id].mong = (players[p.id].mong || 0) + 200;
        } else if (p.status === 'out') {
          players[p.id].mong = (players[p.id].mong || 0) + 100;
        }
      }
    });
    summaryText = '🏃 도망자 팀 승리! 생존·얼음 상태 +200몽 / 관중석(아웃) +100몽 지급!';
  }

  io.emit('minigameEnded', {
    title: '🧊 얼음땡 최종 결과',
    summaryText,
    updatedPlayers: players
  });
  resetMinigame();
}

// ==========================================
// 4. 미니게임 3: 🕵️ 거짓말 탐지기 (라이어 게임 - 최소 4명)
// ==========================================
function startLiarGame() {
  mg.phase = 'liar_speak';
  const ids = Object.keys(mg.participants);
  mg.liarId = ids[Math.floor(Math.random() * ids.length)];
  mg.liarTopic = LIAR_TOPICS[Math.floor(Math.random() * LIAR_TOPICS.length)];
  mg.turnOrder = [...ids].sort(() => Math.random() - 0.5);
  mg.turnIndex = 0;
  mg.roundNum = 1;
  mg.speeches = [];
  mg.votes = {};
  mg.runoffIds = null;

  // 원형 테이블 주변으로 둥글게 앉는 좌표 계산
  const radius = 5.5;
  mg.turnOrder.forEach((id, idx) => {
    const ang = (idx / mg.turnOrder.length) * Math.PI * 2;
    const p = mg.participants[id];
    p.x = Math.sin(ang) * radius;
    p.y = 0;
    p.z = Math.cos(ang) * radius;
    p.rotY = ang + Math.PI; // 테이블 중앙을 바라봄
    p.isMoving = false;
  });

  // 각 참가자에게 개별 제시어 전송 (라이어에게만 다른 단어!)
  mg.turnOrder.forEach(id => {
    if (!mg.participants[id].isCpu) {
      const isLiar = (id === mg.liarId);
      io.to(id).emit('liarGameStarted', {
        category: mg.liarTopic.category,
        word: isLiar ? mg.liarTopic.liar : mg.liarTopic.citizen,
        isLiar,
        turnOrder: mg.turnOrder,
        participants: mg.participants
      });
    }
  });

  advanceLiarTurn();
}

function advanceLiarTurn() {
  if (mg.loopTimer) clearInterval(mg.loopTimer);

  // 결선 변론(동점자 추가 발언)인 경우
  if (mg.runoffIds) {
    if (mg.turnIndex >= mg.runoffIds.length) {
      startLiarVote(mg.runoffIds);
      return;
    }
    const speakerId = mg.runoffIds[mg.turnIndex];
    broadcastSpeakerTurn(speakerId, '동점자 최후 변론');
    return;
  }

  // 일반 2바퀴 진행
  if (mg.turnIndex >= mg.turnOrder.length) {
    if (mg.roundNum < 2) {
      mg.roundNum += 1;
      mg.turnIndex = 0;
    } else {
      startLiarVote(mg.turnOrder);
      return;
    }
  }

  const speakerId = mg.turnOrder[mg.turnIndex];
  broadcastSpeakerTurn(speakerId, `${mg.roundNum}바퀴째 발언`);
}

function broadcastSpeakerTurn(speakerId, label) {
  let turnTime = 18;
  io.emit('liarTurnUpdate', {
    speakerId,
    speakerName: mg.participants[speakerId]?.name || '',
    label,
    timeLeft: turnTime,
    speeches: mg.speeches
  });

  // CPU 봇이라면 2.5초 후 제시어에 맞는 자연스러운 힌트 자동 발언
  if (mg.participants[speakerId]?.isCpu) {
    setTimeout(() => {
      if (mg.phase !== 'liar_speak') return;
      const isLiar = (speakerId === mg.liarId);
      const pool = isLiar ? mg.liarTopic.liarHints : mg.liarTopic.citizenHints;
      const hint = pool[(mg.roundNum + mg.turnIndex) % pool.length];
      recordLiarSpeech(speakerId, hint);
    }, 2500);
    return;
  }

  mg.loopTimer = setInterval(() => {
    turnTime -= 1;
    io.emit('liarTurnTick', { timeLeft: turnTime });
    if (turnTime <= 0) {
      clearInterval(mg.loopTimer);
      recordLiarSpeech(speakerId, '(시간 초과로 침묵했습니다)');
    }
  }, 1000);
}

function recordLiarSpeech(speakerId, text) {
  if (mg.loopTimer) clearInterval(mg.loopTimer);
  const p = mg.participants[speakerId];
  if (!p) return;

  const entry = {
    id: speakerId,
    name: p.name,
    text: text.trim().substring(0, 80)
  };
  mg.speeches.push(entry);
  io.emit('liarNewSpeech', { entry, speeches: mg.speeches });

  mg.turnIndex += 1;
  setTimeout(() => {
    if (mg.phase === 'liar_speak') advanceLiarTurn();
  }, 1800);
}

function startLiarVote(candidateIds) {
  mg.phase = 'liar_vote';
  mg.votes = {};
  let voteTime = 15;

  // CPU 봇 자동 투표
  Object.values(mg.participants).forEach(p => {
    if (p.isCpu) {
      const choices = candidateIds.filter(cid => cid !== p.id);
      const pick = choices[Math.floor(Math.random() * choices.length)] || candidateIds[0];
      mg.votes[p.id] = pick;
    }
  });

  io.emit('liarVoteStarted', {
    candidateIds,
    participants: mg.participants,
    timeLeft: voteTime,
    isRunoff: !!mg.runoffIds
  });

  mg.loopTimer = setInterval(() => {
    voteTime -= 1;
    io.emit('liarVoteTick', { timeLeft: voteTime });

    const humanCount = Object.values(mg.participants).filter(p => !p.isCpu).length;
    const totalVotes = Object.keys(mg.votes).length;
    const cpuCount = Object.values(mg.participants).filter(p => p.isCpu).length;

    if (totalVotes >= humanCount + cpuCount || voteTime <= 0) {
      clearInterval(mg.loopTimer);
      resolveLiarVote(candidateIds);
    }
  }, 1000);
}

function resolveLiarVote(candidateIds) {
  const tally = {};
  candidateIds.forEach(id => tally[id] = 0);
  Object.values(mg.votes).forEach(targetId => {
    if (tally[targetId] !== undefined) tally[targetId] += 1;
  });

  const maxVotes = Math.max(...Object.values(tally));
  const topIds = candidateIds.filter(id => tally[id] === maxVotes);

  // 동점자 발생 시: 동점자들만 다시 1번 발언 후 재투표!
  if (topIds.length > 1) {
    mg.phase = 'liar_speak';
    mg.runoffIds = topIds;
    mg.turnIndex = 0;
    const names = topIds.map(id => mg.participants[id]?.name).join(', ');
    io.emit('liarRunoffAnnounced', { tieNames: names });
    setTimeout(() => {
      if (mg.phase === 'liar_speak') advanceLiarTurn();
    }, 2200);
    return;
  }

  // 최종 지목된 1명 판정
  const accusedId = topIds[0];
  const liarName = mg.participants[mg.liarId]?.name || '알 수 없음';
  const accusedName = mg.participants[accusedId]?.name || '알 수 없음';
  const caught = (accusedId === mg.liarId);

  let summaryText = '';
  if (caught) {
    Object.values(mg.participants).forEach(p => {
      if (p.id !== mg.liarId && !p.isCpu && players[p.id]) {
        players[p.id].mong = (players[p.id].mong || 0) + 200;
      }
    });
    summaryText = `🎉 라이어 검거 성공! 지목된 [${accusedName}]님이 라이어였습니다!<br>시민 제시어: <b>${mg.liarTopic.citizen}</b> / 라이어 제시어: <b>${mg.liarTopic.liar}</b><br>시민 전원 +200몽 지급!`;
  } else {
    if (!mg.participants[mg.liarId]?.isCpu && players[mg.liarId]) {
      players[mg.liarId].mong = (players[mg.liarId].mong || 0) + 350;
    }
    summaryText = `😈 라이어 승리! 지목된 [${accusedName}]님은 시민이었습니다!<br>진짜 라이어: <b>${liarName}</b> (제시어: ${mg.liarTopic.liar} vs 시민: ${mg.liarTopic.citizen})<br>라이어에게 +350몽 지급!`;
  }

  io.emit('minigameEnded', {
    title: '🕵️ 거짓말 탐지기 결과',
    summaryText,
    updatedPlayers: players
  });
  resetMinigame();
}

// ==========================================
// 5. 소켓 이벤트 핸들러
// ==========================================
io.on('connection', (socket) => {
  players[socket.id] = {
    id: socket.id,
    name: `플레이어_${socket.id.substring(0, 4)}`,
    mong: 200,
    speedLevel: 0,
    jumpLevel: 0,
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

  socket.on('buyItem', ({ category, itemId }) => {
    const p = players[socket.id];
    if (!p) return;
    if (category === 'speed' && p.speedLevel < 5) {
      const cost = (p.speedLevel + 1) * 50;
      if (p.mong >= cost) { p.mong -= cost; p.speedLevel += 1; socket.emit('shopUpdated', p); }
    } else if (category === 'jump' && p.jumpLevel < 5) {
      const cost = (p.jumpLevel + 1) * 50;
      if (p.mong >= cost) { p.mong -= cost; p.jumpLevel += 1; socket.emit('shopUpdated', p); }
    } else if (category === 'top') {
      const cost = SHOP_PRICES.tops[itemId] ?? 9999;
      if (!p.ownedTops.includes(itemId) && p.mong >= cost) {
        p.mong -= cost; p.ownedTops.push(itemId); p.topStyle = itemId;
        socket.emit('shopUpdated', p); io.emit('playerUpdated', p);
      }
    } else if (category === 'bottom') {
      const cost = SHOP_PRICES.bottoms[itemId] ?? 9999;
      if (!p.ownedBottoms.includes(itemId) && p.mong >= cost) {
        p.mong -= cost; p.ownedBottoms.push(itemId); p.bottomStyle = itemId;
        socket.emit('shopUpdated', p); io.emit('playerUpdated', p);
      }
    } else if (category === 'theme') {
      const cost = SHOP_PRICES.themes[itemId] ?? 9999;
      if (!p.ownedThemes.includes(itemId) && p.mong >= cost) {
        p.mong -= cost; p.ownedThemes.push(itemId); socket.emit('shopUpdated', p);
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
    if (players[socket.id] && mg.phase === 'idle') {
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

  socket.on('requestStartLobby', ({ type, cpuCount, mode }) => {
    if (mg.phase === 'idle') openMinigameLobby(socket.id, type, cpuCount, mode);
  });

  // 방장 즉시 시작 버튼 처리
  socket.on('hostForceStartLobby', () => {
    if (mg.phase === 'lobby' && socket.id === mg.hostId) {
      onLobbyFinished();
    }
  });

  socket.on('joinMinigameLobby', () => {
    if (mg.phase === 'lobby' && players[socket.id] && !mg.participants[socket.id]) {
      players[socket.id].inMinigame = true;
      mg.participants[socket.id] = { id: socket.id, name: players[socket.id].name, isCpu: false };
      io.emit('minigameLobbyTick', { timeLeft: mg.timeLeft, participants: mg.participants });
    }
  });

  socket.on('confirmColorflipTeams', ({ teamCount, assignments }) => {
    if (mg.phase === 'team_setup' && socket.id === mg.hostId) {
      startColorFlipMatch(teamCount, assignments);
    }
  });

  socket.on('submitRps', (choice) => {
    if (mg.phase !== 'rps' || !['rock', 'paper', 'scissors'].includes(choice)) return;
    const grp = mg.rpsGroups.find(g => g.memberIds.includes(socket.id));
    if (grp) grp.choices[socket.id] = choice;
  });

  socket.on('freezetagUseSkill', (skill) => {
    if (mg.phase !== 'playing' || mg.type !== 'freezetag') return;
    const me = mg.participants[socket.id];
    if (!me || me.role !== 'runner' || me.status === 'out') return;
    const runners = Object.values(mg.participants).filter(p => p.role === 'runner');

    if (skill === 'freeze' && me.status === 'normal' && me.freezeCooldown <= 0) {
      me.status = 'frozen'; me.isMoving = false;
      io.emit('freezetagAction', { type: 'freeze', actorId: me.id, targetId: me.id, participants: mg.participants });
    } else if (skill === 'fire' && me.status === 'normal') {
      const target = runners.find(r => r.id !== me.id && r.status === 'frozen' && Math.hypot(r.x - me.x, r.z - me.z) <= 2.8);
      if (target) {
        target.status = 'normal'; target.freezeCooldown = 2.0;
        io.emit('freezetagAction', { type: 'fire', actorId: me.id, targetId: target.id, participants: mg.participants });
      }
    } else if (skill === 'clang' && me.status === 'frozen') {
      const nearbyFrozen = runners.filter(r => r.status === 'frozen' && Math.hypot(r.x - me.x, r.z - me.z) <= 3.2);
      if (nearbyFrozen.length === 2) {
        nearbyFrozen.forEach(r => { r.status = 'normal'; r.freezeCooldown = 2.0; });
        io.emit('freezetagAction', { type: 'clang', actorId: me.id, targetId: nearbyFrozen.find(r => r.id !== me.id).id, participants: mg.participants });
      }
    }
  });

  // 거짓말 탐지기 발언 & 투표 제출
  socket.on('submitLiarSpeech', (text) => {
    if (mg.phase !== 'liar_speak') return;
    const list = mg.runoffIds || mg.turnOrder;
    if (list[mg.turnIndex] === socket.id && text && text.trim()) {
      recordLiarSpeech(socket.id, text);
    }
  });

  socket.on('submitLiarVote', (targetId) => {
    if (mg.phase === 'liar_vote' && mg.participants[socket.id] && mg.participants[targetId]) {
      mg.votes[socket.id] = targetId;
    }
  });

  socket.on('disconnect', () => {
    delete players[socket.id];
    if (mg.participants[socket.id]) delete mg.participants[socket.id];
    io.emit('playerDisconnected', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server v1.4-20261122 running on port ${PORT}`);
});
