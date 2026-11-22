const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static(__dirname));

const supabaseUrl = (process.env.SUPABASE_URL || '').trim();
const supabaseKey = (process.env.SUPABASE_KEY || '').trim();
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

const players = {};
const rooms = {};
const attackRooms = {};

const ADMIN_ID = 'hajun1234adminuser';
const ADMIN_PW = '2cv8cF';

const ALL_TOPS = [
  'tshirt', 'hoodie', 'sweater', 'suit', 'uniform', 'hanbok', 'armor', 'royal',
  'admin_coat', 'admin_robe'
];
const ALL_BOTTOMS = [
  'pants', 'shorts', 'skirt', 'jeans', 'overalls', 'armorpants',
  'admin_greaves', 'admin_leggings'
];
const ALL_THEMES = ['original', 'legacy_pillars', 'simple', 'cute', 'colorful', 'dreamy', 'jungle', 'cathouse'];

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
  tops: { tshirt: 0, hoodie: 40, sweater: 50, suit: 70, uniform: 80, hanbok: 100, armor: 120, royal: 150, admin_coat: 999999, admin_robe: 999999 },
  bottoms: { pants: 0, shorts: 30, skirt: 50, jeans: 50, overalls: 70, armorpants: 110, admin_greaves: 999999, admin_leggings: 999999 },
  themes: { original: 0, legacy_pillars: 30, simple: 40, cute: 60, colorful: 70, dreamy: 90, jungle: 110, cathouse: 120 }
};

const ATTACK_CHARS = {
  rookie:  { id: 'rookie',  name: '루키 슈터',     rarity: '일반',   price: 0,     hp: 3200, atk: 420,  def: 10, speed: 0.25, range: 16, projCount: 1, spread: 0,    color: '#38bdf8' },
  brawler: { id: 'brawler', name: '아이언 펀치',   rarity: '희귀',   price: 500,   hp: 4600, atk: 540,  def: 22, speed: 0.26, range: 11, projCount: 3, spread: 0.25, color: '#ef4444' },
  sniper:  { id: 'sniper',  name: '스카이 스나이퍼', rarity: '초희귀', price: 1200,  hp: 2900, atk: 880,  def: 12, speed: 0.26, range: 26, projCount: 1, spread: 0,    color: '#a855f7' },
  pyro:    { id: 'pyro',    name: '블레이즈 킹',   rarity: '영웅',   price: 2000,  hp: 4200, atk: 720,  def: 20, speed: 0.27, range: 17, projCount: 3, spread: 0.18, color: '#f97316' },
  cyber:   { id: 'cyber',   name: '사이버 닌자',   rarity: '신화',   price: 5000,  hp: 4800, atk: 960,  def: 28, speed: 0.30, range: 19, projCount: 4, spread: 0.22, color: '#10b981' },
  emperor: { id: 'emperor', name: '갤럭시 엠페러', rarity: '전설',   price: 10000, hp: 6200, atk: 1300, def: 38, speed: 0.32, range: 24, projCount: 5, spread: 0.24, color: '#facc15' }
};

function computeCitizenship(p) {
  if (p.isAdmin) return 'admin';
  if ((p.minigameWins || 0) >= 20) return 'yellow';
  if ((p.maxMong || 0) >= 500) return 'special';
  return 'normal';
}

function syncCitizenship(p, socketToNotify) {
  if (!p) return;
  if ((p.mong || 0) > (p.maxMong || 0)) p.maxMong = p.mong;
  const prev = p.citizenship || 'normal';
  const next = computeCitizenship(p);
  p.citizenship = next;
  if (prev !== next && socketToNotify) {
    const labelMap = {
      special: '✨ 특수 시민권 (속도/점프 1.1배 · 테마 해금 · Attack 가젯/스타파워)',
      yellow: '🌟 YELLOW 시민권 (속도/점프 1.2배 · 어드민 1:1 채팅 · 90초마다 +10몽 · Attack 하이퍼차지/버피)',
      admin: '👑 ADMIN 최고권한'
    };
    if (labelMap[next]) {
      socketToNotify.emit('citizenshipUpgraded', { tier: next, message: labelMap[next] + '을 획득했습니다!' });
    }
  }
}

async function savePlayerToDB(p) {
  if (!supabase || !p || !p.username || p.isGuest) return;
  try {
    await supabase
      .from('game_profiles')
      .update({
        nickname: p.name,
        mong: p.mong,
        max_mong: p.maxMong || p.mong,
        minigame_wins: p.minigameWins || 0,
        is_admin: !!p.isAdmin,
        owned_tops: p.ownedTops,
        owned_bottoms: p.ownedBottoms,
        owned_themes: p.ownedThemes,
        face: p.face,
        top_style: p.topStyle,
        top_color: p.topColor,
        bottom_style: p.bottomStyle,
        bottom_color: p.bottomColor,
        attack_data: p.attackData,
        updated_at: new Date().toISOString()
      })
      .eq('username', p.username);
  } catch (err) {
    console.error('DB Save Error:', err.message);
  }
}

// YELLOW 시민권(및 ADMIN) 접속 중 1분 30초마다 자동 +10몽
setInterval(() => {
  Object.values(players).forEach(p => {
    if (p.citizenship === 'yellow' || p.isAdmin) {
      p.mong = (p.mong || 0) + 10;
      syncCitizenship(p, io.sockets.sockets.get(p.id));
      savePlayerToDB(p);
      io.to(p.id).emit('yellowAutoMong', { mong: p.mong, earned: 10 });
    }
  });
}, 90000);

const WORLD_COINS = [];
function spawnCoinPosition(id) {
  return { id, x: (Math.random() - 0.5) * 80, z: (Math.random() - 0.5) * 80 };
}
for (let i = 0; i < 20; i++) WORLD_COINS.push(spawnCoinPosition('coin_' + i));

const LIAR_WORDS_50 = [
  { cat: '음식', word: '짜장면', kw: ['면', '소스', '단무지'], hints: ['식사 시간마다 어김없이 후보에 오르는 익숙한 한 그릇이에요', '그릇 바닥에 남는 진한 여운이 꽤 오래가요', '곁들임 반찬 하나가 없으면 은근히 허전한 느낌이에요', '비벼 먹는 과정 자체가 입맛을 돋워 주는 메뉴예요'] },
  { cat: '음식', word: '떡볶이', kw: ['양념', '분식', '간식'], hints: ['갑자기 기분이 꿀꿀할 때 생각나는 강렬한 기억이 있어요', '한 번 손이 가면 멈추기 힘든 묘한 중독성이 있어요', '누군가와 나눠 먹으면 분위기가 금방 살아나요', '학교 앞이나 길거리 추억이 가장 먼저 떠오르는 간식이에요'] },
  { cat: '음식', word: '치킨', kw: ['야식', '바삭', '조각'], hints: ['시계가 밤을 향해 갈수록 존재감이 커지는 아이콘이에요', '손가락에 묻는 흔적마저 기분 좋게 느껴지는 순간이 있어요', '모임이나 축하 자리에서 빠지면 섭섭한 단골손님이에요', '소리만 들어도 어떤 식감일지 바로 상상되는 음식이에요'] },
  { cat: '음식', word: '피자', kw: ['조각', '도우', '치즈'], hints: ['나눠 갖는 모양새부터 파티 분위기를 만드는 음식이에요', '가장자리 끝부분을 어떻게 처리하느냐로 취향이 갈려요', '따뜻할 때와 식었을 때의 매력이 꽤 다르게 다가와요', '위에 올라가는 조합에 따라 완전히 다른 인상을 줘요'] },
  { cat: '음식', word: '라면', kw: ['끓여', '국물', '면'], hints: ['조리 과정이 단순해서 누구든 자기만의 레시피를 품고 있어요', '비 오는 날이나 유독 지치는 날에 더 깊게 와닿아요', '작은 차이 하나가 전체 인상을 완전히 바꿔놓기도 해요', '냄비 뚜껑을 열기 직전의 향기가 유독 강렬한 음식이에요'] },
  { cat: '동물', word: '강아지', kw: ['반려', '감정', '산책'], hints: ['감정을 숨기지 않고 온몸으로 표현하는 순수함이 있어요', '함께 시간을 보낼수록 서로의 리듬에 맞춰지게 돼요', '밖으로 향하는 발걸음을 가장 설레게 만드는 존재예요', '현관문 소리만 들려도 반갑게 달려오는 모습이 떠올라요'] },
  { cat: '동물', word: '고양이', kw: ['자유', '공간', '움직임'], hints: ['자기만의 페이스를 잃지 않는 도도한 매력이 있어요', '평범한 공간도 단숨에 자기 영역으로 바꾸는 재주가 있어요', '가만히 바라보기만 해도 마음이 차분해지는 순간이 있어요', '높은 곳에서 조용히 내려다보는 시선이 인상적이에요'] },
  { cat: '동물', word: '펭귄', kw: ['추위', '대비', '물'], hints: ['극한의 환경에서도 꿋꿋하게 버텨내는 강인함이 있어요', '환경이 바뀔 때 모습이 극적으로 달라지는 반전이 있어요', '무리를 지어 함께 견뎌내는 모습이 인상적이에요', '뒤뚱거리는 걸음걸이 속에 의외의 민첩함이 숨어 있어요'] },
  { cat: '스포츠', word: '축구', kw: ['팀', '흐름', '경기'], hints: ['예측 불가능한 변수 속에서 흐름을 읽는 눈이 중요해요', '단 한 번의 순간이 경기 전체의 분위기를 뒤집기도 해요', '수많은 사람들의 함성과 함께 커지는 열기가 있어요', '넓은 공간에서 호흡을 맞추며 달리는 매력이 커요'] },
  { cat: '스포츠', word: '농구', kw: ['속도', '공격', '점수'], hints: ['공수 전환이 순식간에 일어나서 눈을 뗄 틈이 없어요', '공중에서 펼쳐지는 짧은 순간의 승부가 짜릿해요', '짧은 시간 안에 점수가 크게 출렁이는 역동성이 있어요', '마지막 1초까지 승부를 알 수 없는 긴장감이 있어요'] },
  { cat: '악기', word: '피아노', kw: ['소리', '화음', '연주'], hints: ['혼자서도 풍성한 울림과 입체적인 분위기를 만들어낼 수 있어요', '손끝의 힘 조절에 따라 거칠기도 하고 부드럽기도 해요', '오랜 시간 곁에 두고 친해지기 좋은 기본기 같은 존재예요', '흑과 백의 질서 속에서 무한한 선율이 태어나요'] },
  { cat: '악기', word: '바이올린', kw: ['선율', '표현', '소리'], hints: ['사람의 목소리처럼 섬세하고 애절한 감정을 담아낼 수 있어요', '조금만 각도가 어긋나도 날카로운 소리가 날 수 있어 조심스러워요', '무대 위에서 시선을 사로잡는 우아한 아우라가 있어요', '활의 움직임에 따라 감정의 깊이가 확연히 달라져요'] },
  { cat: '장소', word: '학교', kw: ['시간', '사람', '성장'], hints: ['매일 같은 시간에 모여 각자의 하루를 쌓아가는 공간이에요', '웃음과 고민, 작은 사건들이 한데 모이는 추억의 무대예요', '종소리와 함께 공기의 결이 달라지는 순간들이 있어요', '졸업하고 나서야 비로소 그리워지는 풍경이 많아요'] },
  { cat: '물건', word: '스마트폰', kw: ['연결', '화면', '일상'], hints: ['하루를 시작하고 끝낼 때 가장 먼저 마주하게 되는 창구예요', '손끝 몇 번만으로 세상과 연결되는 편리함을 줘요', '곁에 없으면 괜히 허전하고 마음이 쓰이는 물건이에요', '배터리 잔량에 따라 마음의 여유가 달라지기도 해요'] },
  { cat: '직업', word: '우주비행사', kw: ['미지', '도전', '궤도'], hints: ['인류가 닿은 가장 먼 미지의 영역을 향해 떠나는 개척자예요', '철저한 준비와 훈련 끝에 비로소 허락되는 특별한 여정이에요', '익숙한 세상을 멀리서 바라보는 시선이 상상력을 자극해요', '중력이 없는 공간에서 임무를 수행하는 특별한 직업이에요'] }
];

const GRID_SIZE = 16;
const TILE_SIZE = 2.0;

function emitToRoom(room, event, payload) {
  Object.values(room.participants).forEach(p => { if (!p.isCpu) io.to(p.id).emit(event, payload); });
}
function getWorldIdleSocketIds() {
  return Object.keys(players).filter(sid => !players[sid].roomId && !players[sid].attackRoomId);
}
function broadcastLobbyToIdle(event, payload) {
  getWorldIdleSocketIds().forEach(sid => io.to(sid).emit(event, payload));
}
function cleanupRoom(roomId) {
  const room = rooms[roomId]; if (!room) return;
  if (room.loopTimer) clearInterval(room.loopTimer);
  Object.values(room.participants).forEach(p => { if (!p.isCpu && players[p.id]) players[p.id].roomId = null; });
  delete rooms[roomId];
}

function createMinigameRoom(hostId, type, cpuCount, mode) {
  const host = players[hostId];
  if (!host || host.roomId || host.attackRoomId) return null;

  const roomId = 'room_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
  const room = {
    id: roomId, phase: 'lobby', type, hostId,
    cpuCount: Math.max(0, Math.min(10, parseInt(cpuCount) || 0)),
    mode: mode || 'solo', timeLeft: 30,
    participants: {}, tiles: [], teamAssignments: {},
    arenaHalfSize: 19, rpsGroups: [], rpsPool: [], targetItCount: 1,
    liarId: null, liarTopic: null, turnOrder: [], turnIndex: 0,
    roundNum: 1, speeches: [], votes: {}, runoffIds: null, loopTimer: null
  };

  rooms[roomId] = room;
  host.roomId = roomId;
  room.participants[hostId] = { id: hostId, name: host.name, isCpu: false };

  const titleMap = {
    colorflip: '🎨 색깔 뒤집기 (1분 / 최소 3명)',
    freezetag: '🧊 얼음땡 (1분 30초 / 최소 5명)',
    liar: '🕵️ 거짓말 탐지기 (최소 4명)'
  };

  const startPayload = {
    roomId, type: room.type, title: titleMap[type] || type,
    hostId, hostName: host.name, mode: room.mode, cpuCount: room.cpuCount,
    timeLeft: room.timeLeft, participants: room.participants
  };

  emitToRoom(room, 'minigameLobbyStarted', startPayload);
  broadcastLobbyToIdle('minigameLobbyStarted', startPayload);

  room.loopTimer = setInterval(() => {
    room.timeLeft -= 1;
    const payload = { roomId, timeLeft: room.timeLeft, participants: room.participants };
    emitToRoom(room, 'minigameLobbyTick', payload);
    broadcastLobbyToIdle('minigameLobbyTick', payload);
    if (room.timeLeft <= 0) { clearInterval(room.loopTimer); onRoomLobbyFinished(roomId); }
  }, 1000);
  return room;
}

function onRoomLobbyFinished(roomId) {
  const room = rooms[roomId]; if (!room || room.phase !== 'lobby') return;
  if (room.loopTimer) clearInterval(room.loopTimer);

  for (let i = 1; i <= room.cpuCount; i++) {
    const cpuId = 'cpu_' + i;
    room.participants[cpuId] = { id: cpuId, name: 'CPU봇_' + i, isCpu: true };
  }

  const allList = Object.values(room.participants);
  if (room.type === 'colorflip') {
    if (allList.length < 3) {
      emitToRoom(room, 'minigameCancelled', { roomId, reason: '색깔 뒤집기는 총 3명 이상이어야 시작할 수 있습니다! (현재 ' + allList.length + '명)' });
      broadcastLobbyToIdle('minigameLobbyClosed', { roomId }); cleanupRoom(roomId); return;
    }
    broadcastLobbyToIdle('minigameLobbyClosed', { roomId });
    if (room.mode === 'team') {
      room.phase = 'team_setup';
      allList.forEach((p, idx) => { room.teamAssignments[p.id] = idx % 2; });
      emitToRoom(room, 'colorflipTeamSetup', { roomId, hostId: room.hostId, participants: room.participants, assignments: room.teamAssignments });
    } else startColorFlipRoom(roomId, 1, {});
  } else if (room.type === 'freezetag') {
    if (allList.length < 5) {
      emitToRoom(room, 'minigameCancelled', { roomId, reason: '얼음땡은 총 5명 이상이어야 시작할 수 있습니다! (현재 ' + allList.length + '명)' });
      broadcastLobbyToIdle('minigameLobbyClosed', { roomId }); cleanupRoom(roomId); return;
    }
    broadcastLobbyToIdle('minigameLobbyClosed', { roomId }); startRpsRoom(roomId);
  } else if (room.type === 'liar') {
    if (allList.length < 4) {
      emitToRoom(room, 'minigameCancelled', { roomId, reason: '거짓말 탐지기는 총 4명 이상이어야 시작할 수 있습니다! (현재 ' + allList.length + '명)' });
      broadcastLobbyToIdle('minigameLobbyClosed', { roomId }); cleanupRoom(roomId); return;
    }
    broadcastLobbyToIdle('minigameLobbyClosed', { roomId }); startLiarRoom(roomId);
  }
}

function awardMinigameWin(playerId, bonusMong) {
  const p = players[playerId]; if (!p) return;
  p.mong = (p.mong || 0) + bonusMong;
  p.minigameWins = (p.minigameWins || 0) + 1;
  syncCitizenship(p, io.sockets.sockets.get(playerId));
  savePlayerToDB(p);
}

function startColorFlipRoom(roomId, teamCount, assignments) {
  const room = rooms[roomId]; if (!room) return;
  const safeTeamCount = (room.mode === 'team') ? Math.max(2, Math.min(4, parseInt(teamCount) || 2)) : 1;
  room.phase = 'playing'; room.timeLeft = 60;
  room.tiles = new Array(GRID_SIZE * GRID_SIZE).fill(null);

  Object.values(room.participants).forEach((p, idx) => {
    let color = GAME_COLORS[idx % GAME_COLORS.length], teamIdx = null;
    if (room.mode === 'team') {
      const rawT = (assignments[p.id] !== undefined) ? parseInt(assignments[p.id]) : (idx % safeTeamCount);
      teamIdx = ((rawT % safeTeamCount) + safeTeamCount) % safeTeamCount;
      color = TEAM_PALETTE[teamIdx].color;
    }
    const angle = Math.random() * Math.PI * 2;
    p.color = color; p.teamIdx = teamIdx;
    p.x = (Math.random() - 0.5) * 22; p.z = (Math.random() - 0.5) * 22;
    p.rotY = angle; p.isMoving = p.isCpu; p.dirX = Math.sin(angle); p.dirZ = Math.cos(angle); p.aiTimer = 1 + Math.random() * 1.5;
  });

  emitToRoom(room, 'colorflipMatchStarted', { roomId, mode: room.mode, teamCount: safeTeamCount, timeLeft: room.timeLeft, participants: room.participants, tiles: room.tiles });
  let secAccum = 0;
  room.loopTimer = setInterval(() => {
    if (room.phase !== 'playing') return;
    const dt = 0.05; secAccum += dt;
    Object.values(room.participants).forEach(p => {
      if (p.isCpu) {
        p.aiTimer -= dt;
        if (p.aiTimer <= 0 || Math.abs(p.x) > 14.5 || Math.abs(p.z) > 14.5) {
          const targetAngle = Math.atan2(-p.x + (Math.random() - 0.5) * 18, -p.z + (Math.random() - 0.5) * 18);
          p.dirX = Math.sin(targetAngle); p.dirZ = Math.cos(targetAngle); p.rotY = targetAngle; p.aiTimer = 0.7 + Math.random() * 1.4;
        }
        p.x = Math.max(-15, Math.min(15, p.x + p.dirX * 0.36)); p.z = Math.max(-15, Math.min(15, p.z + p.dirZ * 0.36));
      }
      const col = Math.floor((p.x + (GRID_SIZE * TILE_SIZE) / 2) / TILE_SIZE);
      const row = Math.floor((p.z + (GRID_SIZE * TILE_SIZE) / 2) / TILE_SIZE);
      if (col >= 0 && col < GRID_SIZE && row >= 0 && row < GRID_SIZE) {
        const idx = row * GRID_SIZE + col;
        const ownerKey = (room.mode === 'team') ? ('team_' + p.teamIdx) : p.id;
        if (room.tiles[idx] !== ownerKey) { room.tiles[idx] = ownerKey; emitToRoom(room, 'tileFlipped', { index: idx, ownerKey, color: p.color }); }
      }
    });
    emitToRoom(room, 'minigameActorsUpdate', room.participants);
    if (secAccum >= 1.0) {
      secAccum = 0; room.timeLeft -= 1;
      emitToRoom(room, 'colorflipTick', { timeLeft: room.timeLeft, scoreboard: computeRoomColorFlipScores(room) });
      if (room.timeLeft <= 0) finishColorFlipRoom(roomId);
    }
  }, 50);
}

function computeRoomColorFlipScores(room) {
  if (room.mode === 'team') {
    const teamCounts = {};
    room.tiles.forEach(k => { if (k) teamCounts[k] = (teamCounts[k] || 0) + 1; });
    const usedTeams = [...new Set(Object.values(room.participants).map(p => p.teamIdx))];
    return usedTeams.map(tIdx => ({ key: 'team_' + tIdx, teamIdx: tIdx, name: TEAM_PALETTE[tIdx] ? TEAM_PALETTE[tIdx].name : (tIdx + 1) + '팀', color: TEAM_PALETTE[tIdx] ? TEAM_PALETTE[tIdx].color : '#fff', count: teamCounts['team_' + tIdx] || 0 })).sort((a, b) => b.count - a.count);
  }
  const counts = {};
  room.tiles.forEach(id => { if (id) counts[id] = (counts[id] || 0) + 1; });
  return Object.values(room.participants).map(p => ({ key: p.id, id: p.id, name: p.name, color: p.color, isCpu: p.isCpu, count: counts[p.id] || 0 })).sort((a, b) => b.count - a.count);
}

function finishColorFlipRoom(roomId) {
  const room = rooms[roomId]; if (!room) return;
  if (room.loopTimer) clearInterval(room.loopTimer);
  const scoreboard = computeRoomColorFlipScores(room), top = scoreboard[0];
  let summaryText = '';
  if (room.mode === 'team' && top) {
    Object.values(room.participants).forEach(p => { if (p.teamIdx === top.teamIdx && !p.isCpu) awardMinigameWin(p.id, 100); });
    summaryText = '우승 팀: ' + top.name + ' (' + top.count + '칸) — 모둠 전원 +100몽 & 승리 +1!';
  } else if (top) {
    if (!top.isCpu) awardMinigameWin(top.id, 100);
    summaryText = '1등 우승: ' + top.name + ' (' + top.count + '칸) — +100몽 & 승리 +1!';
  }
  emitToRoom(room, 'minigameEnded', { title: '🎨 색깔 뒤집기 결과', summaryText, updatedPlayers: players });
  cleanupRoom(roomId);
}

function startRpsRoom(roomId) {
  const room = rooms[roomId]; if (!room) return;
  room.phase = 'rps';
  const allIds = Object.keys(room.participants);
  room.targetItCount = Math.max(1, Math.round(allIds.length * 0.13));
  room.rpsPool = [...allIds];
  runRpsRoomRound(roomId);
}

function runRpsRoomRound(roomId) {
  const room = rooms[roomId]; if (!room) return;
  if (room.rpsPool.length <= room.targetItCount) {
    const itIds = room.rpsPool.slice(0, room.targetItCount);
    if (itIds.length < room.targetItCount) {
      const others = Object.keys(room.participants).filter(id => !itIds.includes(id));
      while (itIds.length < room.targetItCount && others.length > 0) itIds.push(others.shift());
    }
    startFreezeTagRoom(roomId, itIds); return;
  }
  const shuffled = [...room.rpsPool].sort(() => Math.random() - 0.5), groups = [];
  let i = 0;
  while (i < shuffled.length) {
    const rem = shuffled.length - i;
    if (rem === 4) { groups.push(shuffled.slice(i, i + 2)); groups.push(shuffled.slice(i + 2, i + 4)); break; }
    else if (rem <= 3) { groups.push(shuffled.slice(i)); break; }
    else { groups.push(shuffled.slice(i, i + 3)); i += 3; }
  }
  room.rpsGroups = groups.map((memberIds, idx) => {
    const choices = {};
    memberIds.forEach(id => { if (room.participants[id] && room.participants[id].isCpu) choices[id] = ['rock', 'paper', 'scissors'][Math.floor(Math.random() * 3)]; });
    return { groupIdx: idx, memberIds, choices };
  });
  emitToRoom(room, 'rpsRoundStarted', { targetItCount: room.targetItCount, groups: room.rpsGroups, participants: room.participants, timeLeft: 10 });
  let rpsTimer = 10;
  room.loopTimer = setInterval(() => {
    rpsTimer -= 1; emitToRoom(room, 'rpsTick', { timeLeft: rpsTimer });
    if (room.rpsGroups.every(g => g.memberIds.every(id => g.choices[id])) || rpsTimer <= 0) { clearInterval(room.loopTimer); resolveRpsRoomRound(roomId); }
  }, 1000);
}

function getRpsLosers(memberIds, choices) {
  const opts = ['rock', 'paper', 'scissors'];
  memberIds.forEach(id => { if (!choices[id]) choices[id] = opts[Math.floor(Math.random() * 3)]; });
  const uniqueMoves = [...new Set(memberIds.map(id => choices[id]))];
  if (uniqueMoves.length === 1 || uniqueMoves.length === 3) return [...memberIds];
  const [m1, m2] = uniqueMoves;
  const m1BeatsM2 = (m1 === 'rock' && m2 === 'scissors') || (m1 === 'scissors' && m2 === 'paper') || (m1 === 'paper' && m2 === 'rock');
  const losingMove = m1BeatsM2 ? m2 : m1;
  return memberIds.filter(id => choices[id] === losingMove);
}

function resolveRpsRoomRound(roomId) {
  const room = rooms[roomId]; if (!room) return;
  const nextPool = [];
  room.rpsGroups.forEach(g => nextPool.push(...getRpsLosers(g.memberIds, g.choices)));
  emitToRoom(room, 'rpsRoundResult', { losers: nextPool, participants: room.participants });
  room.rpsPool = nextPool;
  setTimeout(() => { if (rooms[roomId] && rooms[roomId].phase === 'rps') runRpsRoomRound(roomId); }, 2000);
}

function startFreezeTagRoom(roomId, itIds) {
  const room = rooms[roomId]; if (!room) return;
  room.phase = 'playing'; room.timeLeft = 90;
  const count = Object.keys(room.participants).length;
  room.arenaHalfSize = Math.min(33, 18 + Math.floor(count * 1.1));
  const spawnLim = room.arenaHalfSize - 2.5;

  Object.values(room.participants).forEach(p => {
    const isIt = itIds.includes(p.id);
    p.role = isIt ? 'it' : 'runner'; p.status = 'normal';
    p.x = isIt ? (Math.random() - 0.5) * 4 : (Math.random() > 0.5 ? 1 : -1) * (spawnLim * 0.65 + Math.random() * (spawnLim * 0.25));
    p.y = 0; p.z = isIt ? (Math.random() - 0.5) * 4 : (Math.random() > 0.5 ? 1 : -1) * (spawnLim * 0.65 + Math.random() * (spawnLim * 0.25));
    p.rotY = Math.random() * Math.PI * 2; p.isMoving = p.isCpu; p.dirX = Math.sin(p.rotY); p.dirZ = Math.cos(p.rotY); p.aiTimer = 0.6; p.freezeCooldown = 0;
  });

  emitToRoom(room, 'freezetagMatchStarted', { timeLeft: room.timeLeft, arenaHalfSize: room.arenaHalfSize, participants: room.participants });
  let secAccum = 0;
  room.loopTimer = setInterval(() => {
    if (room.phase !== 'playing') return;
    const dt = 0.05; secAccum += dt;
    const allP = Object.values(room.participants), its = allP.filter(p => p.role === 'it'), runners = allP.filter(p => p.role === 'runner');
    const lim = room.arenaHalfSize - 1.0;

    allP.forEach(p => {
      if (p.freezeCooldown > 0) p.freezeCooldown = Math.max(0, p.freezeCooldown - dt);
      if (!p.isCpu) return;
      if (p.role === 'it') {
        const targets = runners.filter(r => r.status === 'normal');
        if (targets.length > 0) {
          targets.sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z));
          const ang = Math.atan2(targets[0].x - p.x, targets[0].z - p.z);
          p.rotY = ang; p.x = Math.max(-lim, Math.min(lim, p.x + Math.sin(ang) * 0.23)); p.z = Math.max(-lim, Math.min(lim, p.z + Math.cos(ang) * 0.23)); p.isMoving = true;
        }
      } else {
        if (p.status === 'out') { p.isMoving = false; return; }
        if (p.status === 'frozen') {
          p.isMoving = false;
          const nearbyFrozen = runners.filter(r => r.status === 'frozen' && Math.hypot(r.x - p.x, r.z - p.z) <= 3.2);
          if (nearbyFrozen.length === 2) {
            nearbyFrozen.forEach(r => { r.status = 'normal'; r.freezeCooldown = 2.0; });
            emitToRoom(room, 'freezetagAction', { type: 'clang', actorId: p.id, targetId: nearbyFrozen.find(r => r.id !== p.id).id, participants: room.participants });
          }
          return;
        }
        let nearestIt = null, minItDist = Infinity;
        its.forEach(it => { const d = Math.hypot(it.x - p.x, it.z - p.z); if (d < minItDist) { minItDist = d; nearestIt = it; } });
        if (nearestIt && minItDist < 3.6 && p.freezeCooldown <= 0) {
          p.status = 'frozen'; p.isMoving = false;
          emitToRoom(room, 'freezetagAction', { type: 'freeze', actorId: p.id, targetId: p.id, participants: room.participants }); return;
        }
        const frozenMate = runners.find(r => r.status === 'frozen');
        if (frozenMate) {
          const dist = Math.hypot(frozenMate.x - p.x, frozenMate.z - p.z), ang = Math.atan2(frozenMate.x - p.x, frozenMate.z - p.z);
          p.rotY = ang; p.x = Math.max(-lim, Math.min(lim, p.x + Math.sin(ang) * 0.24)); p.z = Math.max(-lim, Math.min(lim, p.z + Math.cos(ang) * 0.24)); p.isMoving = true;
          if (dist < 2.3) { frozenMate.status = 'normal'; frozenMate.freezeCooldown = 2.0; emitToRoom(room, 'freezetagAction', { type: 'fire', actorId: p.id, targetId: frozenMate.id, participants: room.participants }); }
          return;
        }
        p.isMoving = true;
        if (nearestIt && minItDist < 14) {
          let ang = Math.atan2(p.x - nearestIt.x, p.z - nearestIt.z);
          if (Math.abs(p.x) > lim - 2.0 || Math.abs(p.z) > lim - 2.0) ang = Math.atan2(-p.x, -p.z) + (Math.random() - 0.5) * 1.2;
          p.rotY = ang; p.x = Math.max(-lim, Math.min(lim, p.x + Math.sin(ang) * 0.24)); p.z = Math.max(-lim, Math.min(lim, p.z + Math.cos(ang) * 0.24));
        } else {
          p.aiTimer -= dt;
          if (p.aiTimer <= 0 || Math.abs(p.x) > lim - 1.5 || Math.abs(p.z) > lim - 1.5) {
            const ang = Math.atan2(-p.x + (Math.random() - 0.5) * lim, -p.z + (Math.random() - 0.5) * lim);
            p.dirX = Math.sin(ang); p.dirZ = Math.cos(ang); p.rotY = ang; p.aiTimer = 0.8 + Math.random() * 1.2;
          }
          p.x = Math.max(-lim, Math.min(lim, p.x + p.dirX * 0.22)); p.z = Math.max(-lim, Math.min(lim, p.z + p.dirZ * 0.22));
        }
      }
    });

    its.forEach(it => {
      runners.forEach(r => {
        if (r.status === 'normal' && Math.hypot(it.x - r.x, it.z - r.z) < 1.5) {
          r.status = 'out'; r.isMoving = false;
          r.x = (Math.random() - 0.5) * 14; r.y = 4.6; r.z = -(room.arenaHalfSize + 3.0); r.rotY = 0;
          if (!r.isCpu && players[r.id]) { players[r.id].mong = Math.max(0, (players[r.id].mong || 0) - 10); savePlayerToDB(players[r.id]); }
          emitToRoom(room, 'freezetagAction', { type: 'out', actorId: it.id, targetId: r.id, participants: room.participants, updatedPlayers: players });
        }
      });
    });

    emitToRoom(room, 'minigameActorsUpdate', room.participants);
    if (runners.filter(r => r.status === 'normal').length === 0) { finishFreezeTagRoom(roomId, true); return; }
    if (secAccum >= 1.0) {
      secAccum = 0; room.timeLeft -= 1; emitToRoom(room, 'freezetagTick', { timeLeft: room.timeLeft });
      if (room.timeLeft <= 0) finishFreezeTagRoom(roomId, false);
    }
  }, 50);
}

function finishFreezeTagRoom(roomId, itsWon) {
  const room = rooms[roomId]; if (!room) return;
  if (room.loopTimer) clearInterval(room.loopTimer);
  const allP = Object.values(room.participants);
  let summaryText = '';
  if (itsWon) {
    allP.forEach(p => { if (p.role === 'it' && !p.isCpu) awardMinigameWin(p.id, 200); });
    summaryText = '👹 술래 팀 승리! 술래 +200몽 & 승리 +1!';
  } else {
    allP.forEach(p => {
      if (p.role === 'runner' && !p.isCpu && players[p.id]) {
        if (p.status === 'normal' || p.status === 'frozen') awardMinigameWin(p.id, 200);
        else if (p.status === 'out') awardMinigameWin(p.id, 100);
      }
    });
    summaryText = '🏃 도망자 팀 승리! 생존 +200몽 / 관중석 +100몽 & 승리 +1!';
  }
  emitToRoom(room, 'minigameEnded', { title: '🧊 얼음땡 최종 결과', summaryText, updatedPlayers: players });
  cleanupRoom(roomId);
}

function startLiarRoom(roomId) {
  const room = rooms[roomId]; if (!room) return;
  room.phase = 'liar_speak';
  const ids = Object.keys(room.participants);
  room.liarId = ids[Math.floor(Math.random() * ids.length)];
  room.liarTopic = LIAR_WORDS_50[Math.floor(Math.random() * LIAR_WORDS_50.length)];
  room.turnOrder = [...ids].sort(() => Math.random() - 0.5);
  room.turnIndex = 0; room.roundNum = 1; room.speeches = []; room.votes = {}; room.runoffIds = null;

  const radius = 5.5;
  room.turnOrder.forEach((id, idx) => {
    const ang = (idx / room.turnOrder.length) * Math.PI * 2, p = room.participants[id];
    p.x = Math.sin(ang) * radius; p.y = 0; p.z = Math.cos(ang) * radius; p.rotY = ang + Math.PI; p.isMoving = false;
  });

  room.turnOrder.forEach(id => {
    if (!room.participants[id].isCpu) {
      const isLiar = (id === room.liarId);
      io.to(id).emit('liarGameStarted', { category: room.liarTopic.cat, word: isLiar ? null : room.liarTopic.word, isLiar, turnOrder: room.turnOrder, participants: room.participants });
    }
  });
  advanceLiarRoomTurn(roomId);
}

function advanceLiarRoomTurn(roomId) {
  const room = rooms[roomId]; if (!room) return;
  if (room.loopTimer) clearInterval(room.loopTimer);
  if (room.runoffIds) {
    if (room.turnIndex >= room.runoffIds.length) { startLiarRoomVote(roomId, room.runoffIds); return; }
    broadcastRoomSpeakerTurn(roomId, room.runoffIds[room.turnIndex], '동점자 최후 변론'); return;
  }
  if (room.turnIndex >= room.turnOrder.length) {
    if (room.roundNum < 2) { room.roundNum += 1; room.turnIndex = 0; }
    else { startLiarRoomVote(roomId, room.turnOrder); return; }
  }
  broadcastRoomSpeakerTurn(roomId, room.turnOrder[room.turnIndex], room.roundNum + '바퀴째 발언');
}

// 2회째 턴에서는 CPU가 이전에 했던 말을 절대 반복하지 않도록 중복 제거!
function generateRoomCpuSpeech(room, cpuId) {
  const prevByCpu = room.speeches.filter(s => s.id === cpuId).map(s => s.text);
  const allPrev = room.speeches.map(s => s.text);

  if (cpuId !== room.liarId) {
    const pool = room.liarTopic.hints || [];
    const fresh = pool.filter(h => !prevByCpu.includes(h) && !allPrev.includes(h));
    if (fresh.length > 0) return fresh[Math.floor(Math.random() * fresh.length)];
    const notMine = pool.filter(h => !prevByCpu.includes(h));
    if (notMine.length > 0) return notMine[Math.floor(Math.random() * notMine.length)];
    return '방금 나온 설명들처럼 일상에서 꽤 자주 마주치는 대상이에요.';
  }

  const crypticPool = [
    '분위기나 상황으로만 떠올리면 은근히 헷갈릴 수도 있을 것 같아요.',
    '앞에서 나온 이야기들을 들으면서 머릿속으로 그림을 그려보고 있어요.',
    '직접 마주했을 때 느껴지는 공기나 템포가 꽤 인상적인 주제네요.',
    '사람마다 받아들이는 포인트가 조금씩 다를 수 있는 대상이라고 생각해요.',
    '조금만 시선을 바꿔서 생각하면 또 다른 매력이 보이는 편이에요.',
    '익숙한 듯하면서도 막상 설명하려니 말로 풀기가 쉽지 않네요.'
  ];
  const freshLiar = crypticPool.filter(c => !prevByCpu.includes(c));
  return freshLiar.length > 0
    ? freshLiar[Math.floor(Math.random() * freshLiar.length)]
    : '저도 앞선 분들과 비슷한 인상을 받고 있어요.';
}

function broadcastRoomSpeakerTurn(roomId, speakerId, label) {
  const room = rooms[roomId]; if (!room) return;
  let turnTime = 60;
  emitToRoom(room, 'liarTurnUpdate', { speakerId, speakerName: room.participants[speakerId] ? room.participants[speakerId].name : '', label, timeLeft: turnTime, speeches: room.speeches });
  if (room.participants[speakerId] && room.participants[speakerId].isCpu) {
    setTimeout(() => { if (rooms[roomId] && rooms[roomId].phase === 'liar_speak') recordRoomLiarSpeech(roomId, speakerId, generateRoomCpuSpeech(room, speakerId)); }, 2800);
    return;
  }
  room.loopTimer = setInterval(() => {
    turnTime -= 1; emitToRoom(room, 'liarTurnTick', { timeLeft: turnTime });
    if (turnTime <= 0) { clearInterval(room.loopTimer); recordRoomLiarSpeech(roomId, speakerId, '(시간 초과로 발언하지 못했습니다)'); }
  }, 1000);
}

function recordRoomLiarSpeech(roomId, speakerId, text) {
  const room = rooms[roomId]; if (!room) return;
  if (room.loopTimer) clearInterval(room.loopTimer);
  const p = room.participants[speakerId]; if (!p) return;
  const entry = { id: speakerId, name: p.name, text: text.trim().substring(0, 100) };
  room.speeches.push(entry); emitToRoom(room, 'liarNewSpeech', { entry, speeches: room.speeches });
  room.turnIndex += 1;
  setTimeout(() => { if (rooms[roomId] && rooms[roomId].phase === 'liar_speak') advanceLiarRoomTurn(roomId); }, 1800);
}

function computeRoomCpuVote(room, voterId, candidateIds) {
  const others = candidateIds.filter(id => id !== voterId);
  if (others.length === 0) return candidateIds[0];
  const keywords = room.liarTopic.kw || [];
  const suspicionScores = others.map(cid => {
    const userSpeeches = room.speeches.filter(s => s.id === cid).map(s => s.text).join(' ');
    let score = 0;
    if (userSpeeches.includes('시간 초과') || userSpeeches.trim().length < 8) score += 45;
    let kwHits = 0; keywords.forEach(k => { if (userSpeeches.includes(k)) kwHits++; });
    if (kwHits === 0) score += 25; else score -= kwHits * 15;
    score += Math.random() * 14;
    return { id: cid, score };
  });
  suspicionScores.sort((a, b) => b.score - a.score);
  return suspicionScores[0].id;
}

function startLiarRoomVote(roomId, candidateIds) {
  const room = rooms[roomId]; if (!room) return;
  room.phase = 'liar_vote'; room.votes = {}; let voteTime = 20;
  Object.values(room.participants).forEach(p => { if (p.isCpu) room.votes[p.id] = computeRoomCpuVote(room, p.id, candidateIds); });
  emitToRoom(room, 'liarVoteStarted', { candidateIds, participants: room.participants, timeLeft: voteTime, isRunoff: !!room.runoffIds });
  room.loopTimer = setInterval(() => {
    voteTime -= 1; emitToRoom(room, 'liarVoteTick', { timeLeft: voteTime });
    if (Object.keys(room.votes).length >= Object.keys(room.participants).length || voteTime <= 0) { clearInterval(room.loopTimer); resolveLiarRoomVote(roomId, candidateIds); }
  }, 1000);
}

function resolveLiarRoomVote(roomId, candidateIds) {
  const room = rooms[roomId]; if (!room) return;
  const tally = {}; candidateIds.forEach(id => tally[id] = 0);
  Object.values(room.votes).forEach(tid => { if (tally[tid] !== undefined) tally[tid] += 1; });
  const maxVotes = Math.max(...Object.values(tally)), topIds = candidateIds.filter(id => tally[id] === maxVotes);

  if (topIds.length > 1) {
    room.phase = 'liar_speak'; room.runoffIds = topIds; room.turnIndex = 0;
    emitToRoom(room, 'liarRunoffAnnounced', { tieNames: topIds.map(id => room.participants[id] ? room.participants[id].name : '').join(', ') });
    setTimeout(() => { if (rooms[roomId] && rooms[roomId].phase === 'liar_speak') advanceLiarRoomTurn(roomId); }, 2200); return;
  }

  const accusedId = topIds[0];
  const liarName = room.participants[room.liarId] ? room.participants[room.liarId].name : '알 수 없음';
  const accusedName = room.participants[accusedId] ? room.participants[accusedId].name : '알 수 없음';
  const caught = (accusedId === room.liarId);
  let summaryText = '';

  if (caught) {
    Object.values(room.participants).forEach(p => { if (p.id !== room.liarId && !p.isCpu) awardMinigameWin(p.id, 200); });
    summaryText = '🎉 라이어 검거 성공! 지목된 [' + accusedName + ']님이 라이어였습니다!<br>제시어: <b>' + room.liarTopic.word + '</b> (' + room.liarTopic.cat + ')<br>시민 전원 +200몽 & 승리 +1!';
  } else {
    if (room.participants[room.liarId] && !room.participants[room.liarId].isCpu) awardMinigameWin(room.liarId, 350);
    summaryText = '😈 라이어 승리! 지목된 [' + accusedName + ']님은 시민이었습니다!<br>진짜 라이어: <b>' + liarName + '</b> / 제시어: <b>' + room.liarTopic.word + '</b><br>라이어에게 +350몽 & 승리 +1!';
  }
  emitToRoom(room, 'minigameEnded', { title: '🕵️ 거짓말 탐지기 결과', summaryText, updatedPlayers: players });
  cleanupRoom(roomId);
}

// ============================================================
// Attack (독립 월드 배틀) 서버 엔진
// ============================================================
const ATTACK_WALLS = [
  { x: -12, z: -10, w: 6, d: 2.4 }, { x: 12, z: -10, w: 6, d: 2.4 },
  { x: -12, z: 10, w: 6, d: 2.4 },  { x: 12, z: 10, w: 6, d: 2.4 },
  { x: 0, z: -16, w: 8, d: 2.2 },   { x: 0, z: 16, w: 8, d: 2.2 },
  { x: -20, z: 0, w: 2.4, d: 8 },   { x: 20, z: 0, w: 2.4, d: 8 }
];

const ATTACK_BUSHES = [
  { x: -18, z: -16, r: 4.2 }, { x: 18, z: -16, r: 4.2 },
  { x: -18, z: 16, r: 4.2 },  { x: 18, z: 16, r: 4.2 },
  { x: -7, z: 0, r: 3.8 },    { x: 7, z: 0, r: 3.8 }
];

function hitWall(x, z, pad = 0.7) {
  for (const w of ATTACK_WALLS) {
    if (Math.abs(x - w.x) < (w.w / 2 + pad) && Math.abs(z - w.z) < (w.d / 2 + pad)) return true;
  }
  return false;
}
function isInBush(x, z) { return ATTACK_BUSHES.some(b => Math.hypot(x - b.x, z - b.z) <= b.r); }

function buildAttackFighter(id, name, team, isCpu, charId, hpLv, atkLv, defLv, citizenship) {
  const base = ATTACK_CHARS[charId] || ATTACK_CHARS.rookie;
  const hasStarPower = ['special', 'yellow', 'admin'].includes(citizenship);
  const hasBuffie = ['yellow', 'admin'].includes(citizenship);
  const maxHp = Math.round((base.hp + hpLv * 350) * (hasStarPower ? 1.12 : 1.0) * (hasBuffie ? 1.08 : 1.0));
  const atk = Math.round((base.atk + atkLv * 65) * (hasStarPower ? 1.12 : 1.0) * (hasBuffie ? 1.1 : 1.0));
  const def = Math.min(70, base.def + defLv * 3 + (hasBuffie ? 5 : 0));
  return {
    id, name, team, isCpu, charId: base.id, color: base.color, citizenship,
    maxHp, hp: maxHp, atk, def, speed: base.speed, range: base.range,
    projCount: base.projCount, spread: base.spread,
    x: team === 0 ? -22 : (team === 1 ? 22 : (Math.random() - 0.5) * 32),
    z: (Math.random() - 0.5) * 18,
    rotY: 0, alive: true, respawnTimer: 0, inBush: false,
    superCharge: 0, gadgetCd: 0, hyperCharge: 0, hyperActiveTimer: 0,
    gems: 0, stars: 2, shootCd: 0
  };
}

function startAttackMatch(hostSocketId, mode) {
  const host = players[hostSocketId];
  if (!host || host.roomId || host.attackRoomId) return;

  const roomId = 'atk_' + Date.now() + '_' + Math.floor(Math.random() * 999);
  const isFFA = (mode === 'showdown');
  const room = {
    id: roomId, mode, timeLeft: 120,
    fighters: {}, projectiles: [], gems: [],
    ball: { x: 0, z: 0, vx: 0, vz: 0 },
    safes: { 0: { x: -24, z: 0, hp: 18000, maxHp: 18000 }, 1: { x: 24, z: 0, hp: 18000, maxHp: 18000 } },
    scores: { 0: 0, 1: 0 }, gemTimer: { team: null, sec: 0 },
    gasRadius: 34, gemSpawnCd: 2.5, loopTimer: null
  };

  attackRooms[roomId] = room;
  host.attackRoomId = roomId;

  const ad = host.attackData || { selectedChar: 'rookie', hpLv: 0, atkLv: 0, defLv: 0 };
  room.fighters[hostSocketId] = buildAttackFighter(
    hostSocketId, host.name, isFFA ? 99 : 0, false,
    ad.selectedChar, ad.hpLv || 0, ad.atkLv || 0, ad.defLv || 0, host.citizenship
  );

  const charKeys = Object.keys(ATTACK_CHARS);
  for (let slotIdx = 1; slotIdx < 6; slotIdx++) {
    const botId = 'atkbot_' + slotIdx;
    const team = isFFA ? (100 + slotIdx) : (slotIdx % 2);
    const botChar = charKeys[Math.floor(Math.random() * Math.min(4, charKeys.length))];
    room.fighters[botId] = buildAttackFighter(botId, '배틀봇_' + slotIdx, team, true, botChar, 1, 1, 1, 'normal');
  }

  io.to(hostSocketId).emit('attackMatchStarted', {
    roomId, mode, walls: ATTACK_WALLS, bushes: ATTACK_BUSHES,
    fighters: room.fighters, safes: room.safes, ball: room.ball,
    timeLeft: room.timeLeft, gasRadius: room.gasRadius
  });

  let secAcc = 0;
  room.loopTimer = setInterval(() => {
    const dt = 0.05; secAcc += dt;
    if (room.mode === 'showdown') room.gasRadius = Math.max(7, room.gasRadius - dt * 0.25);
    if (room.mode === 'gemgrab') {
      room.gemSpawnCd -= dt;
      if (room.gemSpawnCd <= 0 && room.gems.length < 15) {
        room.gemSpawnCd = 4.5;
        room.gems.push({ id: 'g_' + Date.now() + Math.random(), x: (Math.random() - 0.5) * 4, z: (Math.random() - 0.5) * 4 });
      }
    }
    if (room.mode === 'brawlball') {
      room.ball.x += room.ball.vx * dt * 20; room.ball.z += room.ball.vz * dt * 20;
      room.ball.vx *= 0.92; room.ball.vz *= 0.92;
      if (Math.abs(room.ball.z) > 25) { room.ball.vz *= -0.8; room.ball.z = Math.sign(room.ball.z) * 25; }
      if (room.ball.x > 27 && Math.abs(room.ball.z) < 6) {
        room.scores[0] += 1; room.ball = { x: 0, z: 0, vx: 0, vz: 0 };
        if (room.scores[0] >= 2) { finishAttackMatch(roomId, 0, '⚽ 브롤볼 2골 선취 승리!'); return; }
      } else if (room.ball.x < -27 && Math.abs(room.ball.z) < 6) {
        room.scores[1] += 1; room.ball = { x: 0, z: 0, vx: 0, vz: 0 };
        if (room.scores[1] >= 2) { finishAttackMatch(roomId, 1, '⚽ 브롤볼 2골 선취 승리!'); return; }
      } else if (Math.abs(room.ball.x) > 27) { room.ball.vx *= -0.8; room.ball.x = Math.sign(room.ball.x) * 27; }
    }

    const allF = Object.values(room.fighters);
    allF.forEach(f => {
      if (f.shootCd > 0) f.shootCd = Math.max(0, f.shootCd - dt);
      if (f.gadgetCd > 0) f.gadgetCd = Math.max(0, f.gadgetCd - dt);
      if (f.hyperActiveTimer > 0) f.hyperActiveTimer = Math.max(0, f.hyperActiveTimer - dt);
      if (!f.alive) {
        if (room.mode !== 'showdown' && room.mode !== 'knockout') {
          f.respawnTimer -= dt;
          if (f.respawnTimer <= 0) { f.alive = true; f.hp = f.maxHp; f.x = f.team === 0 ? -22 : 22; f.z = (Math.random() - 0.5) * 16; }
        }
        return;
      }
      f.inBush = isInBush(f.x, f.z);
      if (room.mode === 'showdown' && Math.hypot(f.x, f.z) > room.gasRadius) {
        f.hp -= 220 * dt; if (f.hp <= 0) handleFighterDeath(room, f, null);
      }
      if (room.mode === 'gemgrab') {
        for (let i = room.gems.length - 1; i >= 0; i--) {
          if (Math.hypot(f.x - room.gems[i].x, f.z - room.gems[i].z) < 1.8) { f.gems += 1; room.gems.splice(i, 1); }
        }
      }
      if (room.mode === 'brawlball' && Math.hypot(f.x - room.ball.x, f.z - room.ball.z) < 1.8) {
        const ang = Math.atan2(room.ball.x - f.x, room.ball.z - f.z);
        room.ball.vx = Math.sin(ang) * 0.9; room.ball.vz = Math.cos(ang) * 0.9;
      }
      if (f.isCpu) {
        const enemies = allF.filter(o => o.alive && o.id !== f.id && o.team !== f.team && (!o.inBush || Math.hypot(o.x - f.x, o.z - f.z) < 6));
        if (enemies.length > 0) {
          enemies.sort((a, b) => Math.hypot(a.x - f.x, a.z - f.z) - Math.hypot(b.x - f.x, b.z - f.z));
          const t = enemies[0], dist = Math.hypot(t.x - f.x, t.z - f.z), ang = Math.atan2(t.x - f.x, t.z - f.z);
          f.rotY = ang;
          if (dist > f.range * 0.65) {
            const nx = f.x + Math.sin(ang) * f.speed * 0.85, nz = f.z + Math.cos(ang) * f.speed * 0.85;
            if (!hitWall(nx, nz)) { f.x = Math.max(-27, Math.min(27, nx)); f.z = Math.max(-24, Math.min(24, nz)); }
          }
          if (dist <= f.range && f.shootCd <= 0) { fireAttackProjectile(room, f, ang, false); f.shootCd = 1.1; }
        }
      }
    });

    for (let i = room.projectiles.length - 1; i >= 0; i--) {
      const pr = room.projectiles[i];
      pr.x += pr.vx * dt * 20; pr.z += pr.vz * dt * 20; pr.dist += Math.hypot(pr.vx, pr.vz) * dt * 20;
      if (pr.dist > pr.maxDist || Math.abs(pr.x) > 29 || Math.abs(pr.z) > 27 || hitWall(pr.x, pr.z, 0.2)) { room.projectiles.splice(i, 1); continue; }
      if (room.mode === 'heist') {
        const enemyTeam = pr.team === 0 ? 1 : 0, safe = room.safes[enemyTeam];
        if (safe && Math.hypot(pr.x - safe.x, pr.z - safe.z) < 2.6) {
          safe.hp = Math.max(0, safe.hp - pr.dmg); room.projectiles.splice(i, 1);
          if (safe.hp <= 0) { finishAttackMatch(roomId, pr.team, '💰 하이스트 상대 금고 파괴 승리!'); return; }
          continue;
        }
      }
      for (const target of allF) {
        if (!target.alive || target.id === pr.ownerId || target.team === pr.team) continue;
        if (Math.hypot(pr.x - target.x, pr.z - target.z) < 1.45) {
          target.hp -= Math.max(80, Math.round(pr.dmg * (1 - target.def / 100)));
          const owner = room.fighters[pr.ownerId];
          if (owner) { owner.superCharge = Math.min(100, owner.superCharge + 25); owner.hyperCharge = Math.min(100, owner.hyperCharge + 14); }
          if (target.hp <= 0) handleFighterDeath(room, target, owner);
          room.projectiles.splice(i, 1); break;
        }
      }
    }

    if (room.mode === 'showdown') {
      const aliveList = allF.filter(f => f.alive);
      if (aliveList.length <= 1) { finishAttackMatch(roomId, aliveList[0] ? aliveList[0].id : null, '🏆 쇼다운 최후의 1인 승리!'); return; }
    } else if (room.mode === 'knockout') {
      if (allF.filter(f => f.team === 0 && f.alive).length === 0) { finishAttackMatch(roomId, 1, '💀 녹아웃 상대 팀 전멸!'); return; }
      if (allF.filter(f => f.team === 1 && f.alive).length === 0) { finishAttackMatch(roomId, 0, '💀 녹아웃 적 팀 전멸 승리!'); return; }
    }

    if (secAcc >= 1.0) {
      secAcc = 0; room.timeLeft -= 1;
      if (room.mode === 'gemgrab') {
        const g0 = allF.filter(f => f.team === 0).reduce((s, f) => s + f.gems, 0);
        const g1 = allF.filter(f => f.team === 1).reduce((s, f) => s + f.gems, 0);
        room.scores[0] = g0; room.scores[1] = g1;
        if (g0 >= 10 && g0 > g1) {
          if (room.gemTimer.team === 0) room.gemTimer.sec += 1; else room.gemTimer = { team: 0, sec: 1 };
          if (room.gemTimer.sec >= 10) { finishAttackMatch(roomId, 0, '💎 젬그랩 보석 10개 방어 성공!'); return; }
        } else if (g1 >= 10 && g1 > g0) {
          if (room.gemTimer.team === 1) room.gemTimer.sec += 1; else room.gemTimer = { team: 1, sec: 1 };
          if (room.gemTimer.sec >= 10) { finishAttackMatch(roomId, 1, '💎 젬그랩 상대 팀 10개 방어!'); return; }
        } else room.gemTimer = { team: null, sec: 0 };
      }
      if (room.timeLeft <= 0) { finishAttackMatch(roomId, room.scores[0] >= room.scores[1] ? 0 : 1, '⏱️ 시간 종료! 점수 판정 승리!'); return; }
    }

    allF.forEach(f => {
      if (!f.isCpu) io.to(f.id).emit('attackStateUpdate', { fighters: room.fighters, projectiles: room.projectiles, gems: room.gems, ball: room.ball, safes: room.safes, scores: room.scores, timeLeft: room.timeLeft, gasRadius: room.gasRadius, gemTimer: room.gemTimer });
    });
  }, 50);
}

function handleFighterDeath(room, target, killer) {
  target.alive = false; target.hp = 0; target.respawnTimer = 4.0;
  if (room.mode === 'gemgrab' && target.gems > 0) {
    for (let k = 0; k < target.gems; k++) room.gems.push({ id: 'gd_' + Date.now() + Math.random(), x: target.x + (Math.random() - 0.5) * 2.5, z: target.z + (Math.random() - 0.5) * 2.5 });
    target.gems = 0;
  }
  if (room.mode === 'bounty' && killer) { room.scores[killer.team] = (room.scores[killer.team] || 0) + target.stars; killer.stars = Math.min(7, killer.stars + 1); target.stars = 2; }
}

function fireAttackProjectile(room, fighter, angle, isSuper) {
  const mult = (isSuper ? 1.85 : 1.0) * (fighter.hyperActiveTimer > 0 ? 1.45 : 1.0);
  const count = isSuper ? fighter.projCount + 2 : fighter.projCount;
  const spread = isSuper ? 0.28 : fighter.spread;
  for (let i = 0; i < count; i++) {
    const offset = count === 1 ? 0 : (i - (count - 1) / 2) * spread;
    const a = angle + offset;
    room.projectiles.push({ ownerId: fighter.id, team: fighter.team, color: isSuper ? '#facc15' : fighter.color, x: fighter.x, z: fighter.z, vx: Math.sin(a) * 1.15, vz: Math.cos(a) * 1.15, dmg: Math.round(fighter.atk * mult), dist: 0, maxDist: fighter.range * (isSuper ? 1.25 : 1.0), isSuper });
  }
}

function finishAttackMatch(roomId, winnerKey, reasonText) {
  const room = attackRooms[roomId]; if (!room) return;
  if (room.loopTimer) clearInterval(room.loopTimer);
  Object.values(room.fighters).forEach(f => {
    if (!f.isCpu && players[f.id]) {
      const p = players[f.id]; p.attackRoomId = null;
      const won = (room.mode === 'showdown') ? (f.id === winnerKey) : (f.team === winnerKey);
      const reward = won ? 180 : 50;
      p.mong = (p.mong || 0) + reward;
      syncCitizenship(p, io.sockets.sockets.get(f.id));
      savePlayerToDB(p);
      io.to(f.id).emit('attackMatchEnded', { won, reward, reasonText, mong: p.mong, citizenship: p.citizenship, maxMong: p.maxMong });
    }
  });
  delete attackRooms[roomId];
}

function buildPlayerSessionFromRow(socketId, row, isGuest) {
  const isAdm = !!row.is_admin;
  const maxMong = Math.max(row.mong !== undefined ? row.mong : 200, row.max_mong || 0);
  const p = {
    id: socketId, username: row.username, name: row.nickname || row.username, isGuest: !!isGuest,
    mong: row.mong !== undefined ? row.mong : 200, maxMong, minigameWins: row.minigame_wins || 0,
    isAdmin: isAdm, adminBoostActive: isAdm, isInvisible: false,
    ownedTops: isAdm ? [...ALL_TOPS] : (Array.isArray(row.owned_tops) ? row.owned_tops : ['tshirt']),
    ownedBottoms: isAdm ? [...ALL_BOTTOMS] : (Array.isArray(row.owned_bottoms) ? row.owned_bottoms : ['pants']),
    ownedThemes: isAdm ? [...ALL_THEMES] : (Array.isArray(row.owned_themes) ? row.owned_themes : ['original']),
    attackData: row.attack_data && typeof row.attack_data === 'object' ? row.attack_data : { selectedChar: 'rookie', ownedChars: ['rookie'], hpLv: 0, atkLv: 0, defLv: 0 },
    roomId: null, attackRoomId: null,
    x: (Math.random() - 0.5) * 6, y: 0, z: (Math.random() - 0.5) * 6, rotY: 0, isMoving: false,
    face: row.face || 'happy', topStyle: row.top_style || 'tshirt', topColor: row.top_color || '#3b82f6',
    bottomStyle: row.bottom_style || 'pants', bottomColor: row.bottom_color || '#1e293b'
  };
  p.citizenship = computeCitizenship(p);
  return p;
}

io.on('connection', (socket) => {
  socket.on('authRegister', async ({ username, nickname, password }) => {
    const cleanUser = (username || '').trim().substring(0, 14), cleanNick = (nickname || '').trim().substring(0, 12), cleanPw = (password || '').trim();
    if (cleanUser.length < 2 || cleanNick.length < 2 || cleanPw.length < 2) { socket.emit('authError', '아이디, 닉네임, 비밀번호를 모두 2글자 이상 입력해 주세욥!!'); return; }
    if (!supabase) { socket.emit('authError', '서버 데이터베이스(Supabase) 환경변수가 연결되지 않았습니다ㅠㅠ'); return; }
    try {
      const { data: existing } = await supabase.from('game_profiles').select('username').eq('username', cleanUser).maybeSingle();
      if (existing) { socket.emit('authError', '이미 사용 중인 아이디에유. 다른 아이디를 입력해 주세요!'); return; }
      const newRow = {
        username: cleanUser, nickname: cleanNick, password: cleanPw,
        mong: 200, max_mong: 200, minigame_wins: 0, speed_level: 0, jump_level: 0, is_admin: false,
        owned_tops: ['tshirt'], owned_bottoms: ['pants'], owned_themes: ['original'],
        face: 'happy', top_style: 'tshirt', top_color: '#3b82f6', bottom_style: 'pants', bottom_color: '#1e293b',
        attack_data: { selectedChar: 'rookie', ownedChars: ['rookie'], hpLv: 0, atkLv: 0, defLv: 0 }
      };
      const { error: insertErr } = await supabase.from('game_profiles').insert(newRow);
      if (insertErr) { socket.emit('authError', '회원가입 저장 중 오류: ' + insertErr.message); return; }
      const p = buildPlayerSessionFromRow(socket.id, newRow, false);
      players[socket.id] = p;
      socket.emit('authSuccess', { me: p, players, worldCoins: WORLD_COINS, attackChars: ATTACK_CHARS });
      socket.broadcast.emit('newPlayer', p);
    } catch (e) { socket.emit('authError', '회원가입 처리 중 오류가 발생했습니다.ㅠㅠ'); }
  });

  socket.on('authLogin', async ({ username, password }) => {
    const cleanUser = (username || '').trim().substring(0, 14), cleanPw = (password || '').trim();
    if (!cleanUser || !cleanPw) { socket.emit('authError', '아이디와 비밀번호를 모두 입력하셈요'); return; }
    if (!supabase) { socket.emit('authError', '서버 데이터베이스(Supabase) 환경변수가 연결되지 않았습니다ㅠㅠ'); return; }
    try {
      const { data: row, error } = await supabase.from('game_profiles').select('*').eq('username', cleanUser).maybeSingle();
      if (error || !row) { socket.emit('authError', '존재하지 않는 아이디에유ㅠ. 먼저 회원가입을 해주세요!'); return; }
      if (row.password !== cleanPw) { socket.emit('authError', '비밀번호가 일치하지 않습니다.ㅋ'); return; }
      Object.keys(players).forEach(sid => {
        if (players[sid].username === cleanUser && sid !== socket.id) {
          io.to(sid).emit('adminKicked', { byName: '중복 로그인 감지' });
          delete players[sid]; io.emit('playerDisconnected', sid);
        }
      });
      const p = buildPlayerSessionFromRow(socket.id, row, false);
      players[socket.id] = p;
      socket.emit('authSuccess', { me: p, players, worldCoins: WORLD_COINS, attackChars: ATTACK_CHARS });
      socket.broadcast.emit('newPlayer', p);
    } catch (e) { socket.emit('authError', '로그인 처리 중 오류가 발생했습니다.ㅠㅠ'); }
  });

  socket.on('authGuest', () => {
    const guestId = 'guest_' + socket.id.substring(0, 4);
    const p = buildPlayerSessionFromRow(socket.id, { username: guestId, nickname: '게스트_' + socket.id.substring(0, 4) }, true);
    players[socket.id] = p;
    socket.emit('authSuccess', { me: p, players, worldCoins: WORLD_COINS, attackChars: ATTACK_CHARS });
    socket.broadcast.emit('newPlayer', p);
  });

  // 로그아웃
  socket.on('authLogout', () => {
    const p = players[socket.id];
    if (p) { savePlayerToDB(p); delete players[socket.id]; io.emit('playerDisconnected', socket.id); }
    socket.emit('loggedOut');
  });

  // 회원 탈퇴 (DB 영구 삭제)
  socket.on('authDeleteAccount', async () => {
    const p = players[socket.id];
    if (!p) return;
    if (!p.isGuest && supabase && p.username) {
      try { await supabase.from('game_profiles').delete().eq('username', p.username); } catch (e) {}
    }
    delete players[socket.id];
    io.emit('playerDisconnected', socket.id);
    socket.emit('accountDeleted');
  });

  socket.on('updateAccountSettings', async ({ newNickname, newPassword }) => {
    const p = players[socket.id]; if (!p) return;
    const cleanNick = (newNickname || '').trim().substring(0, 12), cleanPw = (newPassword || '').trim();
    let changed = false;
    if (cleanNick && cleanNick.length >= 2 && cleanNick !== p.name) { p.name = cleanNick; changed = true; }
    if (cleanPw && cleanPw.length >= 2 && !p.isGuest && supabase) { await supabase.from('game_profiles').update({ password: cleanPw }).eq('username', p.username); changed = true; }
    if (changed) { savePlayerToDB(p); socket.emit('accountSettingsUpdated', { name: p.name, passwordChanged: cleanPw.length >= 2 }); io.emit('playerUpdated', p); }
  });

  socket.on('sendAdminDM', (text) => {
    const p = players[socket.id]; if (!p || (p.citizenship !== 'yellow' && !p.isAdmin)) return;
    const clean = (text || '').trim().substring(0, 120); if (!clean) return;
    const payload = { fromId: socket.id, fromName: p.name, isAdmin: p.isAdmin, text: clean };
    socket.emit('receiveAdminDM', payload);
    Object.values(players).forEach(other => {
      if (other.id !== socket.id && (other.isAdmin || (p.isAdmin && other.citizenship === 'yellow'))) io.to(other.id).emit('receiveAdminDM', payload);
    });
  });

  socket.on('adminLogin', ({ id, pw }) => {
    const p = players[socket.id]; if (!p) return;
    if ((id || '').trim() === ADMIN_ID && (pw || '').trim() === ADMIN_PW) {
      p.isAdmin = true; p.adminBoostActive = true; p.mong = (p.mong || 0) + 1000;
      p.ownedTops = [...ALL_TOPS]; p.ownedBottoms = [...ALL_BOTTOMS]; p.ownedThemes = [...ALL_THEMES];
      syncCitizenship(p, socket); savePlayerToDB(p);
      socket.emit('adminAuthSuccess', p); io.emit('playerUpdated', p);
    } else socket.emit('adminAuthFail', '관리자 아이디 또는 비밀번호가 올바르지 않습니다.ㅋ');
  });

  socket.on('adminToggleBoost', () => { const p = players[socket.id]; if (!p || !p.isAdmin) return; p.adminBoostActive = !p.adminBoostActive; socket.emit('adminAuthSuccess', p); });
  socket.on('adminToggleInvisible', () => { const p = players[socket.id]; if (!p || !p.isAdmin) return; p.isInvisible = !p.isInvisible; io.emit('adminPlayerStealth', { id: socket.id, isInvisible: p.isInvisible }); socket.emit('adminAuthSuccess', p); });
  socket.on('adminKickUser', (targetId) => {
    const p = players[socket.id]; if (!p || !p.isAdmin || !players[targetId] || targetId === socket.id) return;
    const kickedName = players[targetId].name;
    io.to(targetId).emit('adminKicked', { byName: p.name });
    const ts = io.sockets.sockets.get(targetId); if (ts) ts.disconnect(true);
    delete players[targetId]; io.emit('playerDisconnected', targetId);
    io.emit('adminGlobalAlert', { senderName: 'ADMIN', message: '[' + kickedName + '] 님이 관리자에 의해 하준의 오픈!온라인 월드에서 강제퇴장되었어요! 아쉬운거죠 뭐;ㅋ' });
  });
  socket.on('adminBroadcastAlert', (alertText) => { const p = players[socket.id]; if (!p || !p.isAdmin) return; const clean = (alertText || '').trim().substring(0, 120); if (clean) io.emit('adminGlobalAlert', { senderName: p.name, message: clean }); });

  socket.on('collectWorldCoin', (coinId) => {
    const p = players[socket.id], coin = WORLD_COINS.find(c => c.id === coinId);
    if (!p || !coin || p.roomId || p.attackRoomId) return;
    if (Math.hypot(p.x - coin.x, p.z - coin.z) <= 2.6) {
      p.mong = (p.mong || 0) + 2;
      const nextPos = spawnCoinPosition(coinId); coin.x = nextPos.x; coin.z = nextPos.z;
      syncCitizenship(p, socket); savePlayerToDB(p);
      socket.emit('coinCollected', { mong: p.mong, earned: 2, citizenship: p.citizenship, maxMong: p.maxMong });
      io.emit('worldCoinMoved', coin);
    }
  });

  socket.on('updateProfile', (data) => {
    const p = players[socket.id]; if (!p) return;
    if (data.face) p.face = data.face;
    if (data.topStyle && p.ownedTops.includes(data.topStyle)) p.topStyle = data.topStyle;
    if (data.topColor) p.topColor = data.topColor;
    if (data.bottomStyle && p.ownedBottoms.includes(data.bottomStyle)) p.bottomStyle = data.bottomStyle;
    if (data.bottomColor) p.bottomColor = data.bottomColor;
    savePlayerToDB(p); io.emit('playerUpdated', p);
  });

  socket.on('buyItem', ({ category, itemId }) => {
    const p = players[socket.id]; if (!p) return;
    if (category === 'top') {
      const cost = SHOP_PRICES.tops[itemId] !== undefined ? SHOP_PRICES.tops[itemId] : 999999;
      if (!p.ownedTops.includes(itemId) && p.mong >= cost) { p.mong -= cost; p.ownedTops.push(itemId); p.topStyle = itemId; savePlayerToDB(p); socket.emit('shopUpdated', p); io.emit('playerUpdated', p); }
    } else if (category === 'bottom') {
      const cost = SHOP_PRICES.bottoms[itemId] !== undefined ? SHOP_PRICES.bottoms[itemId] : 999999;
      if (!p.ownedBottoms.includes(itemId) && p.mong >= cost) { p.mong -= cost; p.ownedBottoms.push(itemId); p.bottomStyle = itemId; savePlayerToDB(p); socket.emit('shopUpdated', p); io.emit('playerUpdated', p); }
    } else if (category === 'theme') {
      if (p.citizenship === 'normal') return;
      const cost = SHOP_PRICES.themes[itemId] !== undefined ? SHOP_PRICES.themes[itemId] : 999999;
      if (!p.ownedThemes.includes(itemId) && p.mong >= cost) { p.mong -= cost; p.ownedThemes.push(itemId); savePlayerToDB(p); socket.emit('shopUpdated', p); }
    }
  });

  socket.on('attackShopAction', ({ action, charId, stat }) => {
    const p = players[socket.id]; if (!p) return;
    const ad = p.attackData || { selectedChar: 'rookie', ownedChars: ['rookie'], hpLv: 0, atkLv: 0, defLv: 0 };
    if (action === 'buyChar' && ATTACK_CHARS[charId]) {
      const ch = ATTACK_CHARS[charId];
      if (!ad.ownedChars.includes(charId) && p.mong >= ch.price) { p.mong -= ch.price; ad.ownedChars.push(charId); ad.selectedChar = charId; }
      else if (ad.ownedChars.includes(charId)) ad.selectedChar = charId;
    } else if (action === 'upgradeStat') {
      const key = stat + 'Lv', curLv = ad[key] || 0, cost = (curLv + 1) * 120;
      if (curLv < 10 && p.mong >= cost) { p.mong -= cost; ad[key] = curLv + 1; }
    }
    p.attackData = ad; savePlayerToDB(p); socket.emit('shopUpdated', p);
  });

  socket.on('startAttackGame', ({ mode }) => startAttackMatch(socket.id, mode || 'showdown'));
  socket.on('attackPlayerMove', ({ x, z, rotY }) => {
    const p = players[socket.id]; if (!p || !p.attackRoomId) return;
    const room = attackRooms[p.attackRoomId]; if (!room) return;
    const f = room.fighters[socket.id];
    if (f && f.alive && !hitWall(x, z, 0.6)) { f.x = Math.max(-27, Math.min(27, x)); f.z = Math.max(-24, Math.min(24, z)); f.rotY = rotY; }
  });
  socket.on('attackUseAction', ({ type, angle }) => {
    const p = players[socket.id]; if (!p || !p.attackRoomId) return;
    const room = attackRooms[p.attackRoomId]; if (!room) return;
    const f = room.fighters[socket.id]; if (!f || !f.alive) return;
    if (type === 'basic' && f.shootCd <= 0) { fireAttackProjectile(room, f, angle, false); f.shootCd = 0.4; }
    else if (type === 'super' && f.superCharge >= 100) { f.superCharge = 0; fireAttackProjectile(room, f, angle, true); }
    else if (type === 'gadget' && ['special', 'yellow', 'admin'].includes(f.citizenship) && f.gadgetCd <= 0) { f.gadgetCd = 10; f.hp = Math.min(f.maxHp, f.hp + Math.round(f.maxHp * 0.35)); }
    else if (type === 'hyper' && ['yellow', 'admin'].includes(f.citizenship) && f.hyperCharge >= 100) { f.hyperCharge = 0; f.hyperActiveTimer = 7.0; }
  });
  socket.on('leaveAttackMatch', () => {
    const p = players[socket.id]; if (!p || !p.attackRoomId) return;
    const roomId = p.attackRoomId; p.attackRoomId = null;
    if (attackRooms[roomId]) { if (attackRooms[roomId].loopTimer) clearInterval(attackRooms[roomId].loopTimer); delete attackRooms[roomId]; }
  });

  socket.on('exchangeTransfer', ({ targetId, mongAmount, giftTop }) => {
    const sender = players[socket.id], receiver = players[targetId];
    if (!sender || !receiver || socket.id === targetId) return;
    const amt = Math.max(0, Math.min(sender.mong, parseInt(mongAmount) || 0));
    if (amt > 0) { sender.mong -= amt; receiver.mong += amt; }
    if (giftTop && sender.ownedTops.includes(giftTop) && !receiver.ownedTops.includes(giftTop)) receiver.ownedTops.push(giftTop);
    syncCitizenship(receiver, io.sockets.sockets.get(targetId));
    savePlayerToDB(sender); savePlayerToDB(receiver);
    socket.emit('shopUpdated', sender); io.to(targetId).emit('shopUpdated', receiver);
    io.to(targetId).emit('chatMessage', { id: 'system', name: '🏦 교환소 알림', text: sender.name + '님이 ' + amt + '몽' + (giftTop ? (' 및 [' + giftTop + '] 의상') : '') + '을 보냈습니다!!!' });
  });

  socket.on('playerMovement', (data) => {
    const p = players[socket.id]; if (!p) return;
    p.x = data.x; p.y = data.y; p.z = data.z; p.rotY = data.rotY; p.isMoving = !!data.isMoving;
    if (p.roomId && rooms[p.roomId]) {
      const room = rooms[p.roomId];
      if (room.phase === 'playing' && room.participants[socket.id]) {
        const mp = room.participants[socket.id];
        if (room.type === 'freezetag' && (mp.status === 'frozen' || mp.status === 'out')) mp.isMoving = false;
        else { mp.x = data.x; mp.z = data.z; mp.rotY = data.rotY; mp.isMoving = p.isMoving; }
      }
    }
    socket.broadcast.emit('playerMoved', p);
  });

  socket.on('playGesture', (g) => { const p = players[socket.id]; if (p && !p.roomId && !p.attackRoomId) io.emit('playerGesture', { id: socket.id, gesture: g }); });
  socket.on('chatMessage', (msg) => { const p = players[socket.id]; if (p && msg && msg.trim()) io.emit('chatMessage', { id: socket.id, name: p.name, text: msg.trim().substring(0, 100) }); });
  socket.on('requestStartLobby', ({ type, cpuCount, mode }) => { const p = players[socket.id]; if (!p || p.roomId || p.attackRoomId) return; createMinigameRoom(socket.id, type, cpuCount, mode); });
  socket.on('joinMinigameLobby', ({ roomId }) => {
    const p = players[socket.id], room = roomId ? rooms[roomId] : Object.values(rooms).find(r => r.phase === 'lobby');
    if (!p || p.roomId || p.attackRoomId || !room || room.phase !== 'lobby') return;
    p.roomId = room.id; room.participants[socket.id] = { id: socket.id, name: p.name, isCpu: false };
    const payload = { roomId: room.id, timeLeft: room.timeLeft, participants: room.participants };
    emitToRoom(room, 'minigameLobbyTick', payload); broadcastLobbyToIdle('minigameLobbyTick', payload);
  });
  socket.on('hostForceStartLobby', () => { const p = players[socket.id]; if (!p || !p.roomId) return; const r = rooms[p.roomId]; if (r && r.phase === 'lobby' && r.hostId === socket.id) onRoomLobbyFinished(r.id); });
  socket.on('hostCancelLobby', () => {
    const p = players[socket.id]; if (!p || !p.roomId) return; const r = rooms[p.roomId];
    if (r && r.phase === 'lobby' && r.hostId === socket.id) { emitToRoom(r, 'minigameCancelled', { roomId: r.id, reason: '방장이 미니게임 모집을 취소했습니다ㅠㅠ' }); broadcastLobbyToIdle('minigameLobbyClosed', { roomId: r.id }); cleanupRoom(r.id); }
  });
  socket.on('confirmColorflipTeams', ({ teamCount, assignments }) => { const p = players[socket.id]; if (!p || !p.roomId) return; const r = rooms[p.roomId]; if (r && r.phase === 'team_setup' && r.hostId === socket.id) startColorFlipRoom(r.id, Math.max(2, Math.min(4, parseInt(teamCount) || 2)), assignments); });
  socket.on('submitRps', (c) => { const p = players[socket.id]; if (!p || !p.roomId) return; const r = rooms[p.roomId]; if (!r || r.phase !== 'rps') return; const g = r.rpsGroups.find(gr => gr.memberIds.includes(socket.id)); if (g) g.choices[socket.id] = c; });
  socket.on('freezetagUseSkill', (skill) => {
    const p = players[socket.id]; if (!p || !p.roomId) return; const room = rooms[p.roomId]; if (!room || room.phase !== 'playing' || room.type !== 'freezetag') return;
    const me = room.participants[socket.id]; if (!me || me.role !== 'runner' || me.status === 'out') return;
    const runners = Object.values(room.participants).filter(r => r.role === 'runner');
    if (skill === 'freeze' && me.status === 'normal' && me.freezeCooldown <= 0) { me.status = 'frozen'; me.isMoving = false; emitToRoom(room, 'freezetagAction', { type: 'freeze', actorId: me.id, targetId: me.id, participants: room.participants }); }
    else if (skill === 'fire' && me.status === 'normal') { const t = runners.find(r => r.id !== me.id && r.status === 'frozen' && Math.hypot(r.x - me.x, r.z - me.z) <= 2.8); if (t) { t.status = 'normal'; t.freezeCooldown = 2.0; emitToRoom(room, 'freezetagAction', { type: 'fire', actorId: me.id, targetId: t.id, participants: room.participants }); } }
    else if (skill === 'clang' && me.status === 'frozen') { const nf = runners.filter(r => r.status === 'frozen' && Math.hypot(r.x - me.x, r.z - me.z) <= 3.2); if (nf.length === 2) { nf.forEach(r => { r.status = 'normal'; r.freezeCooldown = 2.0; }); emitToRoom(room, 'freezetagAction', { type: 'clang', actorId: me.id, targetId: nf.find(r => r.id !== me.id).id, participants: room.participants }); } }
  });
  socket.on('submitLiarSpeech', (text) => { const p = players[socket.id]; if (!p || !p.roomId) return; const r = rooms[p.roomId]; if (!r || r.phase !== 'liar_speak') return; const list = r.runoffIds || r.turnOrder; if (list[r.turnIndex] === socket.id && text && text.trim()) recordRoomLiarSpeech(r.id, socket.id, text); });
  socket.on('submitLiarVote', (tid) => { const p = players[socket.id]; if (!p || !p.roomId) return; const r = rooms[p.roomId]; if (r && r.phase === 'liar_vote' && r.participants[socket.id] && r.participants[tid]) r.votes[socket.id] = tid; });

  socket.on('disconnect', () => {
    const p = players[socket.id];
    if (p) {
      savePlayerToDB(p);
      if (p.roomId && rooms[p.roomId]) {
        const room = rooms[p.roomId]; delete room.participants[socket.id];
        if (Object.values(room.participants).filter(m => !m.isCpu).length === 0) { broadcastLobbyToIdle('minigameLobbyClosed', { roomId: room.id }); cleanupRoom(room.id); }
      }
      if (p.attackRoomId && attackRooms[p.attackRoomId]) { if (attackRooms[p.attackRoomId].loopTimer) clearInterval(attackRooms[p.attackRoomId].loopTimer); delete attackRooms[p.attackRoomId]; }
    }
    delete players[socket.id]; io.emit('playerDisconnected', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log('Server v3.1-20261122 running on port ' + PORT));
