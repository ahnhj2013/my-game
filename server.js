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

const ADMIN_ID = 'hajun1234adminuser';
const ADMIN_PW = '2cv8cF';

const ALL_TOPS = ['tshirt', 'hoodie', 'sweater', 'suit', 'uniform', 'hanbok', 'armor', 'royal'];
const ALL_BOTTOMS = ['pants', 'shorts', 'skirt', 'jeans', 'overalls', 'armorpants'];
const ALL_THEMES = ['original', 'simple', 'cute', 'colorful', 'dreamy', 'jungle', 'cathouse'];

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

const WORLD_COINS = [];
function spawnCoinPosition(id) {
  return {
    id,
    x: (Math.random() - 0.5) * 90,
    z: (Math.random() - 0.5) * 90
  };
}
for (let i = 0; i < 20; i++) {
  WORLD_COINS.push(spawnCoinPosition('coin_' + i));
}

const LIAR_WORDS_50 = [
  { cat: '음식', word: '짜장면', kw: ['면', '소스', '단무지'], hints: ['식사 시간마다 어김없이 후보에 오르는 익숙한 한 그릇이에요', '그릇 바닥에 남는 진한 여운이 꽤 오래가요', '곁들임 반찬 하나가 없으면 은근히 허전한 느낌이에요'] },
  { cat: '음식', word: '떡볶이', kw: ['양념', '분식', '간식'], hints: ['갑자기 기분이 꿀꿀할 때 생각나는 강렬한 기억이 있어요', '한 번 손이 가면 멈추기 힘든 묘한 중독성이 있어요', '누군가와 나눠 먹으면 분위기가 금방 살아나요'] },
  { cat: '음식', word: '치킨', kw: ['야식', '바삭', '조각'], hints: ['시계가 밤을 향해 갈수록 존재감이 커지는 아이콘이에요', '손가락에 묻는 흔적마저 기분 좋게 느껴지는 순간이 있어요', '모임이나 축하 자리에서 빠지면 섭섭한 단골손님이에요'] },
  { cat: '음식', word: '피자', kw: ['조각', '도우', '치즈'], hints: ['나눠 갖는 모양새부터 파티 분위기를 만드는 음식이에요', '가장자리 끝부분을 어떻게 처리하느냐로 취향이 갈려요', '따뜻할 때와 식었을 때의 매력이 꽤 다르게 다가와요'] },
  { cat: '음식', word: '라면', kw: ['끓여', '국물', '면'], hints: ['조리 과정이 단순해서 누구든 자기만의 레시피를 품고 있어요', '비 오는 날이나 유독 지치는 날에 더 깊게 와닿아요', '작은 차이 하나가 전체 인상을 완전히 바꿔놓기도 해요'] },
  { cat: '음식', word: '초밥', kw: ['한입', '간장', '회'], hints: ['정성과 균형이 한 점 안에 압축된 느낌을 줘요', '먹는 순서나 작은 습관에 따라 맛이 미묘하게 달라져요', '조용히 집중해서 음미하게 만드는 매력이 있어요'] },
  { cat: '음식', word: '김밥', kw: ['말아', '소풍', '조각'], hints: ['길게 이어진 형태를 단숨에 여러 조각으로 바꾸는 과정이 인상적이에요', '밖으로 나가는 설레는 기억과 잘 어울리는 메뉴예요', '한입에 쏙 들어가는 크기 덕분에 부담 없이 다가가기 좋아요'] },
  { cat: '음식', word: '삼겹살', kw: ['불판', '굽는', '쌈'], hints: ['시간이 흐르면서 색과 소리가 변해가는 과정을 지켜보는 재미가 있어요', '함께 마주 앉은 사람들과 대화를 자연스럽게 이어줘요', '마지막 마무리 한 입까지 신경 쓰게 만드는 존재예요'] },
  { cat: '음식', word: '아이스크림', kw: ['차가운', '녹는', '디저트'], hints: ['망설이면 금방 형태가 달라져서 서두르게 만드는 대상이에요', '계절의 온도와 정반대되는 감각을 선물해 줘요', '입안에서 사라진 뒤에도 상쾌한 잔상이 남아요'] },
  { cat: '음식', word: '햄버거', kw: ['겹겹', '손', '세트'], hints: ['여러 층이 쌓여 완성되는 구조가 매력적인 음식이에요', '입을 크게 벌려야 하는 순간이 꼭 한 번씩 찾아와요', '빠르고 간편하게 하루의 에너지를 채워주는 느낌이에요'] },
  { cat: '동물', word: '강아지', kw: ['반려', '감정', '산책'], hints: ['감정을 숨기지 않고 온몸으로 표현하는 순수함이 있어요', '함께 시간을 보낼수록 서로의 리듬에 맞춰지게 돼요', '밖으로 향하는 발걸음을 가장 설레게 만드는 존재예요'] },
  { cat: '동물', word: '고양이', kw: ['자유', '공간', '움직임'], hints: ['자기만의 페이스를 잃지 않는 도도한 매력이 있어요', '평범한 공간도 단숨에 자기 영역으로 바꾸는 재주가 있어요', '가만히 바라보기만 해도 마음이 차분해지는 순간이 있어요'] },
  { cat: '동물', word: '코끼리', kw: ['거대한', '기억', '움직임'], hints: ['압도적인 존재감 속에 의외로 섬세한 면이 숨어 있어요', '오랜 기억을 간직할 것 같은 묵직한 인상을 줘요', '천천히 내딛는 걸음마다 무게감이 느껴져요'] },
  { cat: '동물', word: '기린', kw: ['높이', '시선', '자세'], hints: ['남들과는 전혀 다른 높이에서 세상을 바라보는 시선을 가졌어요', '단번에 잊히지 않는 독특한 실루엣이 특징이에요', '일상적인 행동조차 조금 특별해 보이는 자세가 있어요'] },
  { cat: '동물', word: '펭귄', kw: ['추위', '대비', '물'], hints: ['극한의 환경에서도 꿋꿋하게 버텨내는 강인함이 있어요', '환경이 바뀔 때 모습이 극적으로 달라지는 반전이 있어요', '무리를 지어 함께 견뎌내는 모습이 인상적이에요'] },
  { cat: '동물', word: '사자', kw: ['위엄', '무리', '초원'], hints: ['가만히 있어도 주변 공기를 바꾸는 카리스마가 있어요', '왕관처럼 빛나는 상징적인 포인트가 돋보여요', '자연의 거친 질서 속에서 중심을 잡는 느낌이에요'] },
  { cat: '동물', word: '토끼', kw: ['작은', '경계', '도약'], hints: ['작은 인기척에도 민감하게 반응하는 섬세함이 있어요', '가만히 있다가도 순식간에 거리를 좁히거나 멀어져요', '동화 속 이미지가 강하게 겹쳐 떠오르는 존재예요'] },
  { cat: '동물', word: '판다', kw: ['느긋함', '대조', '인기'], hints: ['서두르지 않는 느긋한 태도가 오히려 큰 매력으로 다가와요', '서로 다른 두 가지 색의 대비가 뚜렷하게 기억돼요', '보는 것만으로도 입가에 미소가 번지게 만드는 힘이 있어요'] },
  { cat: '동물', word: '돌고래', kw: ['바다', '신호', '물살'], hints: ['넓고 푸른 공간을 자유롭게 가르며 호흡하는 모습이 멋져요', '보이지 않는 신호로 서로 소통하는 지혜로움이 있어요', '경쾌한 곡선을 그리며 떠오르는 장면이 인상적이에요'] },
  { cat: '동물', word: '다람쥐', kw: ['준비', '작은', '나무'], hints: ['다가올 계절을 미리 준비하는 부지런함이 돋보여요', '작은 몸집으로 분주하게 오가는 모습이 귀여워요', '소중한 것을 꼭꼭 챙겨두는 습관이 떠올라요'] },
  { cat: '스포츠', word: '축구', kw: ['팀', '흐름', '경기'], hints: ['예측 불가능한 변수 속에서 흐름을 읽는 눈이 중요해요', '단 한 번의 순간이 경기 전체의 분위기를 뒤집기도 해요', '수많은 사람들의 함성과 함께 커지는 열기가 있어요'] },
  { cat: '스포츠', word: '농구', kw: ['속도', '공격', '점수'], hints: ['공수 전환이 순식간에 일어나서 눈을 뗄 틈이 없어요', '공중에서 펼쳐지는 짧은 순간의 승부가 짜릿해요', '짧은 시간 안에 점수가 크게 출렁이는 역동성이 있어요'] },
  { cat: '스포츠', word: '야구', kw: ['수싸움', '순간', '경기'], hints: ['조용한 긴장감 속에서 단 한 번의 선택이 승부를 갈라요', '느긋해 보이다가도 순식간에 긴장감이 최고조에 달해요', '기록과 숫자 하나하나에 담긴 이야기가 풍부해요'] },
  { cat: '스포츠', word: '배드민턴', kw: ['공중', '반응', '속도'], hints: ['가벼운 물체가 공중에서 그리는 궤적을 읽는 게 관건이에요', '한 템포만 늦어도 흐름을 내주기 쉬운 섬세한 경기예요', '짧고 빠른 랠리가 이어질 때 손에 땀을 쥐게 해요'] },
  { cat: '스포츠', word: '수영', kw: ['물', '리듬', '숨'], hints: ['나만의 호흡과 리듬을 유지하는 것이 무엇보다 중요해요', '중력에서 조금 벗어난 듯한 독특한 감각을 줘요', '묵묵히 앞으로 나아가는 집중력이 돋보이는 운동이에요'] },
  { cat: '스포츠', word: '태권도', kw: ['절제', '동작', '기합'], hints: ['절제된 균형과 폭발적인 에너지가 공존하는 매력이 있어요', '정해진 틀 속에서 완성도를 끌어올리는 과정이 중요해요', '단단한 정신력과 예의가 함께 따라오는 수련이에요'] },
  { cat: '스포츠', word: '탁구', kw: ['회전', '순발력', '좁은'], hints: ['아주 좁은 공간에서 빛의 속도처럼 오가는 판단력이 필요해요', '보이지 않는 회전력을 얼마나 읽어내느냐가 핵심이에요', '짧은 순간에 승부가 결정되는 긴장감이 있어요'] },
  { cat: '스포츠', word: '스키', kw: ['설원', '균형', '활강'], hints: ['하얀 풍경 위를 가르며 바람을 맞는 해방감이 있어요', '기울기와 무게중심을 미세하게 조절하는 감각이 중요해요', '겨울이 기다려지는 이유 중 하나로 손꼽히곤 해요'] },
  { cat: '스포츠', word: '양궁', kw: ['고요함', '집중', '과녁'], hints: ['주변 소음이 모두 사라진 듯한 고요한 집중력이 필요해요', '숨을 고르고 방아쇠를 놓기 직전의 정적이 압권이에요', '아주 작은 흔들림도 결과에 크게 작용하는 종목이에요'] },
  { cat: '스포츠', word: '볼링', kw: ['집중', '굴림', '결과'], hints: ['내 손을 떠난 뒤에도 마음을 졸이며 지켜보게 되는 과정이 있어요', '일관된 자세와 감각을 유지하는 것이 관건이에요', '마지막 하나가 남았을 때의 긴장감이 특별해요'] },
  { cat: '악기', word: '피아노', kw: ['소리', '화음', '연주'], hints: ['혼자서도 풍성한 울림과 입체적인 분위기를 만들어낼 수 있어요', '손끝의 힘 조절에 따라 거칠기도 하고 부드럽기도 해요', '오랜 시간 곁에 두고 친해지기 좋은 기본기 같은 존재예요'] },
  { cat: '악기', word: '바이올린', kw: ['선율', '표현', '소리'], hints: ['사람의 목소리처럼 섬세하고 애절한 감정을 담아낼 수 있어요', '조금만 각도가 어긋나도 날카로운 소리가 날 수 있어 조심스러워요', '무대 위에서 시선을 사로잡는 우아한 아우라가 있어요'] },
  { cat: '악기', word: '기타', kw: ['울림', '코드', '분위기'], hints: ['어디에 있든 분위기를 가볍고 따뜻하게 띄우는 힘이 있어요', '작은 진동이 몸통을 타고 울려 퍼지는 감각이 좋아요', '함께 노래를 부를 때 가장 자연스럽게 어울리는 악기예요'] },
  { cat: '악기', word: '드럼', kw: ['박자', '심장', '리듬'], hints: ['전체의 심장 박동처럼 중심을 잡아주는 역할을 해요', '에너지를 마음껏 발산할 때 가장 잘 어울리는 존재예요', '소리가 커질수록 현장의 열기도 함께 뜨거워져요'] },
  { cat: '악기', word: '플루트', kw: ['숨결', '맑은', '소리'], hints: ['내쉬는 숨결이 곧바로 맑은 울림으로 바뀌는 신비로움이 있어요', '차가운 금속이 따뜻한 숨을 만나 소리를 내는 과정이 독특해요', '은은하고 청량한 여운을 남기는 음색이 매력적이에요'] },
  { cat: '장소', word: '학교', kw: ['시간', '사람', '성장'], hints: ['매일 같은 시간에 모여 각자의 하루를 쌓아가는 공간이에요', '웃음과 고민, 작은 사건들이 한데 모이는 추억의 무대예요', '종소리와 함께 공기의 결이 달라지는 순간들이 있어요'] },
  { cat: '장소', word: '놀이공원', kw: ['설렘', '현실', '하루'], hints: ['일상의 걱정을 잠시 문밖에 두고 설렘에 집중하게 해줘요', '해가 지고 조명이 켜지면 전혀 다른 세계처럼 변해요', '돌아오는 길에는 기분 좋은 피로감이 남는 곳이에요'] },
  { cat: '장소', word: '도서관', kw: ['정적', '책', '집중'], hints: ['발걸음 소리조차 조심스러워지는 차분한 공기가 흘러요', '각자 다른 세계를 향해 조용히 몰입하는 사람들이 모여 있어요', '시간이 천천히 흐르는 것처럼 느껴지는 공간이에요'] },
  { cat: '장소', word: '영화관', kw: ['어둠', '스크린', '몰입'], hints: ['빛이 꺼지고 화면만 살아남는 순간 완전히 다른 시공간으로 빠져들어요', '낯선 사람들과 같은 타이밍에 숨을 죽이거나 웃게 돼요', '문이 열리고 밖으로 나올 때 여운이 길게 남아요'] },
  { cat: '장소', word: '병원', kw: ['안심', '기다림', '회복'], hints: ['누구나 가급적이면 자주 가지 않길 바라지만 꼭 필요한 곳이에요', '차례를 기다리는 동안 마음이 조금씩 복잡해지곤 해요', '몸과 마음의 신호를 점검하고 안심을 얻는 공간이에요'] },
  { cat: '물건', word: '스마트폰', kw: ['연결', '화면', '일상'], hints: ['하루를 시작하고 끝낼 때 가장 먼저 마주하게 되는 창구예요', '손끝 몇 번만으로 세상과 연결되는 편리함을 줘요', '곁에 없으면 괜히 허전하고 마음이 쓰이는 물건이에요'] },
  { cat: '물건', word: '우산', kw: ['비', '보호', '날씨'], hints: ['하늘의 변덕에 대비해 미리 챙기거나 후회하게 만드는 물건이에요', '작은 방패처럼 머리 위 공간을 지켜주는 역할을 해요', '쓰임이 끝난 뒤 관리하는 방식까지 개성이 드러나요'] },
  { cat: '물건', word: '시계', kw: ['시간', '흐름', '약속'], hints: ['멈추지 않고 계속 앞으로 나아가는 흐름을 보여주는 상징이에요', '약속과 기준을 맞추기 위해 모두가 따르는 약속의 기준점이에요', '문득 올려다볼 때마다 남은 시간을 실감하게 해줘요'] },
  { cat: '물건', word: '거울', kw: ['반사', '모습', '확인'], hints: ['아무 말 없이 있는 그대로의 모습을 비춰주는 정직한 물건이에요', '외출 전 마지막 점검을 맡기는 든든한 도우미예요', '각도와 빛에 따라 전혀 다른 인상을 보여주기도 해요'] },
  { cat: '물건', word: '자전거', kw: ['바람', '균형', '이동'], hints: ['스스로 균형을 잡아야 앞으로 나아갈 수 있는 정직한 탈것이에요', '거리를 스치는 바람을 온몸으로 느끼며 달리는 맛이 있어요', '처음 배울 때 넘어졌던 기억이 유독 선명하게 남곤 해요'] },
  { cat: '직업', word: '소방관', kw: ['위험', '용기', '출동'], hints: ['남들이 등을 돌릴 때 오히려 안쪽으로 발걸음을 옮기는 용기가 있어요', '가장 긴박한 순간에 가장 먼저 떠오르는 믿음직한 이름이에요', '일상의 안전이 얼마나 큰 노력 위에 서 있는지 깨닫게 해줘요'] },
  { cat: '직업', word: '경찰관', kw: ['질서', '신뢰', '순찰'], hints: ['거리의 질서와 사람의 안전을 지키는 든든한 버팀목이에요', '제복에서 풍기는 단단한 신뢰감이 주변을 안심시켜 줘요', '예상치 못한 사건 앞에서 침착하게 움직이는 모습이 인상적이에요'] },
  { cat: '직업', word: '요리사', kw: ['재료', '정성', '맛'], hints: ['평범한 재료에 시간과 감각을 더해 새로운 가치를 만들어내요', '눈과 코와 입을 동시에 사로잡는 마법 같은 과정을 이끌어요', '누군가의 행복한 표정을 목표로 땀 흘리는 직업이에요'] },
  { cat: '직업', word: '우주비행사', kw: ['미지', '도전', '궤도'], hints: ['인류가 닿은 가장 먼 미지의 영역을 향해 떠나는 개척자예요', '철저한 준비와 훈련 끝에 비로소 허락되는 특별한 여정이에요', '익숙한 세상을 멀리서 바라보는 시선이 상상력을 자극해요'] },
  { cat: '직업', word: '선생님', kw: ['배움', '길잡이', '기억'], hints: ['어린 시절의 기억 속에 한마디 말로 오래 남는 분들이 많아요', '스스로 길을 찾을 수 있도록 힌트와 방향을 건네주는 존재예요', '가르치는 순간보다 지켜보며 기다려주는 힘이 큰 자리예요'] }
];

const GRID_SIZE = 16;
const TILE_SIZE = 2.0;

let mgLock = false;
let mg = {
  phase: 'idle',
  type: null,
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
  mgLock = false;
  Object.values(players).forEach(p => { p.inMinigame = false; });
}

function openMinigameLobby(hostId, type, cpuCount, mode) {
  if (mgLock || mg.phase !== 'idle' || !players[hostId]) return false;
  mgLock = true;

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
    colorflip: '🎨 색깔 뒤집기 (1분 / 최소 3명)',
    freezetag: '🧊 얼음땡 (1분 30초 / 최소 5명)',
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

  return true;
}

function onLobbyFinished() {
  if (mg.phase !== 'lobby') return;
  if (mg.loopTimer) clearInterval(mg.loopTimer);

  for (let i = 1; i <= mg.cpuCount; i++) {
    const cpuId = 'cpu_' + i;
    mg.participants[cpuId] = { id: cpuId, name: 'CPU봇_' + i, isCpu: true };
  }

  const allList = Object.values(mg.participants);

  if (mg.type === 'colorflip') {
    if (allList.length < 3) {
      io.emit('minigameCancelled', {
        reason: '색깔 뒤집기는 총 3명 이상이어야 시작할 수 있습니다! (현재 ' + allList.length + '명) 다시 모집해 주세요.'
      });
      resetMinigame();
      return;
    }
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
        reason: '얼음땡은 총 5명 이상이어야 시작할 수 있습니다! (현재 ' + allList.length + '명) 다시 모집해 주세요.'
      });
      resetMinigame();
      return;
    }
    startRpsTournament();
  } else if (mg.type === 'liar') {
    if (allList.length < 4) {
      io.emit('minigameCancelled', {
        reason: '거짓말 탐지기는 총 4명 이상이어야 시작할 수 있습니다! (현재 ' + allList.length + '명) 다시 모집해 주세요.'
      });
      resetMinigame();
      return;
    }
    startLiarGame();
  }
}

function startColorFlipMatch(teamCount, assignments) {
  const safeTeamCount = (mg.mode === 'team') ? Math.max(2, Math.min(4, parseInt(teamCount) || 2)) : 1;
  mg.phase = 'playing';
  mg.timeLeft = 60;
  mg.tiles = new Array(GRID_SIZE * GRID_SIZE).fill(null);

  const list = Object.values(mg.participants);
  list.forEach((p, idx) => {
    let color = GAME_COLORS[idx % GAME_COLORS.length];
    let teamIdx = null;
    if (mg.mode === 'team') {
      const rawT = (assignments[p.id] !== undefined) ? parseInt(assignments[p.id]) : (idx % safeTeamCount);
      teamIdx = ((rawT % safeTeamCount) + safeTeamCount) % safeTeamCount;
      color = TEAM_PALETTE[teamIdx].color;
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
    teamCount: safeTeamCount,
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
          p.dirX = Math.sin(targetAngle); p.dirZ = Math.cos(targetAngle); p.rotY = targetAngle;
          p.aiTimer = 0.7 + Math.random() * 1.4;
        }
        p.x = Math.max(-15, Math.min(15, p.x + p.dirX * 0.36));
        p.z = Math.max(-15, Math.min(15, p.z + p.dirZ * 0.36));
      }

      const col = Math.floor((p.x + (GRID_SIZE * TILE_SIZE) / 2) / TILE_SIZE);
      const row = Math.floor((p.z + (GRID_SIZE * TILE_SIZE) / 2) / TILE_SIZE);
      if (col >= 0 && col < GRID_SIZE && row >= 0 && row < GRID_SIZE) {
        const idx = row * GRID_SIZE + col;
        const ownerKey = (mg.mode === 'team') ? ('team_' + p.teamIdx) : p.id;
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
      if (mg.timeLeft <= 0) finishColorFlipMatch();
    }
  }, 50);
}

function computeColorFlipScores() {
  if (mg.mode === 'team') {
    const teamCounts = {};
    mg.tiles.forEach(ownerKey => { if (ownerKey) teamCounts[ownerKey] = (teamCounts[ownerKey] || 0) + 1; });
    const usedTeams = [...new Set(Object.values(mg.participants).map(p => p.teamIdx))];
    return usedTeams.map(tIdx => ({
      key: 'team_' + tIdx, teamIdx: tIdx,
      name: TEAM_PALETTE[tIdx] ? TEAM_PALETTE[tIdx].name : (tIdx + 1) + '팀',
      color: TEAM_PALETTE[tIdx] ? TEAM_PALETTE[tIdx].color : '#fff',
      count: teamCounts['team_' + tIdx] || 0
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
    summaryText = '우승 팀: ' + top.name + ' (' + top.count + '칸) — 모둠 전원 +100몽 지급!';
  } else if (top) {
    if (!top.isCpu && players[top.id]) {
      players[top.id].mong = (players[top.id].mong || 0) + 100;
    }
    summaryText = '1등 우승: ' + top.name + ' (' + top.count + '칸) — +100몽 지급!';
  }

  io.emit('minigameEnded', {
    title: '🎨 색깔 뒤집기 결과',
    summaryText,
    updatedPlayers: players
  });
  resetMinigame();
}

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
      while (itIds.length < mg.targetItCount && others.length > 0) itIds.push(others.shift());
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
      if (mg.participants[id] && mg.participants[id].isCpu) {
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
  memberIds.forEach(id => { if (!choices[id]) choices[id] = opts[Math.floor(Math.random() * 3)]; });
  const uniqueMoves = [...new Set(memberIds.map(id => choices[id]))];
  if (uniqueMoves.length === 1 || uniqueMoves.length === 3) return [...memberIds];
  const [m1, m2] = uniqueMoves;
  const m1BeatsM2 = (m1 === 'rock' && m2 === 'scissors') || (m1 === 'scissors' && m2 === 'paper') || (m1 === 'paper' && m2 === 'rock');
  const losingMove = m1BeatsM2 ? m2 : m1;
  return memberIds.filter(id => choices[id] === losingMove);
}

function resolveRpsRound() {
  const nextPool = [];
  mg.rpsGroups.forEach(g => nextPool.push(...getRpsLosers(g.memberIds, g.choices)));
  io.emit('rpsRoundResult', { losers: nextPool, participants: mg.participants });
  mg.rpsPool = nextPool;
  setTimeout(() => { if (mg.phase === 'rps') runRpsRound(); }, 2000);
}

function startFreezeTagMatch(itIds) {
  mg.phase = 'playing';
  mg.timeLeft = 90;

  const count = Object.keys(mg.participants).length;
  mg.arenaHalfSize = Math.min(33, 18 + Math.floor(count * 1.1));
  const spawnLim = mg.arenaHalfSize - 2.5;

  Object.values(mg.participants).forEach(p => {
    const isIt = itIds.includes(p.id);
    p.role = isIt ? 'it' : 'runner';
    p.status = 'normal';
    p.x = isIt ? (Math.random() - 0.5) * 4 : (Math.random() > 0.5 ? 1 : -1) * (spawnLim * 0.65 + Math.random() * (spawnLim * 0.25));
    p.y = 0;
    p.z = isIt ? (Math.random() - 0.5) * 4 : (Math.random() > 0.5 ? 1 : -1) * (spawnLim * 0.65 + Math.random() * (spawnLim * 0.25));
    p.rotY = Math.random() * Math.PI * 2;
    p.isMoving = p.isCpu;
    p.dirX = Math.sin(p.rotY);
    p.dirZ = Math.cos(p.rotY);
    p.aiTimer = 0.6;
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
          p.x = Math.max(-lim, Math.min(lim, p.x + Math.sin(ang) * 0.23));
          p.z = Math.max(-lim, Math.min(lim, p.z + Math.cos(ang) * 0.23));
          p.isMoving = true;
        }
      } else {
        if (p.status === 'out') { p.isMoving = false; return; }

        if (p.status === 'frozen') {
          p.isMoving = false;
          const nearbyFrozen = runners.filter(r => r.status === 'frozen' && Math.hypot(r.x - p.x, r.z - p.z) <= 3.2);
          if (nearbyFrozen.length === 2) {
            nearbyFrozen.forEach(r => { r.status = 'normal'; r.freezeCooldown = 2.0; });
            io.emit('freezetagAction', {
              type: 'clang',
              actorId: p.id,
              targetId: nearbyFrozen.find(r => r.id !== p.id).id,
              participants: mg.participants
            });
          }
          return;
        }

        let nearestIt = null;
        let minItDist = Infinity;
        its.forEach(it => {
          const d = Math.hypot(it.x - p.x, it.z - p.z);
          if (d < minItDist) { minItDist = d; nearestIt = it; }
        });

        if (nearestIt && minItDist < 3.6 && p.freezeCooldown <= 0) {
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
          p.x = Math.max(-lim, Math.min(lim, p.x + Math.sin(ang) * 0.24));
          p.z = Math.max(-lim, Math.min(lim, p.z + Math.cos(ang) * 0.24));
          p.isMoving = true;
          if (dist < 2.3) {
            frozenMate.status = 'normal';
            frozenMate.freezeCooldown = 2.0;
            io.emit('freezetagAction', { type: 'fire', actorId: p.id, targetId: frozenMate.id, participants: mg.participants });
          }
          return;
        }

        p.isMoving = true;
        if (nearestIt && minItDist < 14) {
          const awayX = p.x - nearestIt.x;
          const awayZ = p.z - nearestIt.z;
          let ang = Math.atan2(awayX, awayZ);
          if (Math.abs(p.x) > lim - 2.0 || Math.abs(p.z) > lim - 2.0) {
            ang = Math.atan2(-p.x, -p.z) + (Math.random() - 0.5) * 1.2;
          }
          p.rotY = ang;
          p.x = Math.max(-lim, Math.min(lim, p.x + Math.sin(ang) * 0.24));
          p.z = Math.max(-lim, Math.min(lim, p.z + Math.cos(ang) * 0.24));
        } else {
          p.aiTimer -= dt;
          if (p.aiTimer <= 0 || Math.abs(p.x) > lim - 1.5 || Math.abs(p.z) > lim - 1.5) {
            const ang = Math.atan2(-p.x + (Math.random() - 0.5) * lim, -p.z + (Math.random() - 0.5) * lim);
            p.dirX = Math.sin(ang); p.dirZ = Math.cos(ang); p.rotY = ang;
            p.aiTimer = 0.8 + Math.random() * 1.2;
          }
          p.x = Math.max(-lim, Math.min(lim, p.x + p.dirX * 0.22));
          p.z = Math.max(-lim, Math.min(lim, p.z + p.dirZ * 0.22));
        }
      }
    });

    its.forEach(it => {
      runners.forEach(r => {
        if (r.status === 'normal' && Math.hypot(it.x - r.x, it.z - r.z) < 1.5) {
          r.status = 'out';
          r.isMoving = false;
          r.x = (Math.random() - 0.5) * 14;
          r.y = 4.6;
          r.z = -(mg.arenaHalfSize + 4.5);
          r.rotY = 0;
          if (!r.isCpu && players[r.id]) {
            players[r.id].mong = Math.max(0, (players[r.id].mong || 0) - 10);
          }
          io.emit('freezetagAction', {
            type: 'out', actorId: it.id, targetId: r.id,
            participants: mg.participants, updatedPlayers: players
          });
        }
      });
    });

    io.emit('minigameActorsUpdate', mg.participants);

    const activeRunners = runners.filter(r => r.status === 'normal');
    if (activeRunners.length === 0) {
      finishFreezeTagMatch(true);
      return;
    }

    if (secAccum >= 1.0) {
      secAccum = 0;
      mg.timeLeft -= 1;
      io.emit('freezetagTick', { timeLeft: mg.timeLeft });
      if (mg.timeLeft <= 0) finishFreezeTagMatch(false);
    }
  }, 50);
}

function finishFreezeTagMatch(itsWon) {
  if (mg.loopTimer) clearInterval(mg.loopTimer);
  const allP = Object.values(mg.participants);
  let summaryText = '';

  if (itsWon) {
    allP.forEach(p => {
      if (p.role === 'it' && !p.isCpu && players[p.id]) players[p.id].mong = (players[p.id].mong || 0) + 200;
    });
    summaryText = '👹 술래 팀 승리! 전원 얼음/아웃 성공 — 술래 전원 +200몽 지급!';
  } else {
    allP.forEach(p => {
      if (p.role === 'runner' && !p.isCpu && players[p.id]) {
        if (p.status === 'normal' || p.status === 'frozen') players[p.id].mong = (players[p.id].mong || 0) + 200;
        else if (p.status === 'out') players[p.id].mong = (players[p.id].mong || 0) + 100;
      }
    });
    summaryText = '🏃 도망자 팀 승리! 생존·얼음 상태 +200몽 / 생중계 관중석(아웃) +100몽 지급!';
  }

  io.emit('minigameEnded', {
    title: '🧊 얼음땡 최종 결과',
    summaryText,
    updatedPlayers: players
  });
  resetMinigame();
}

function startLiarGame() {
  mg.phase = 'liar_speak';
  const ids = Object.keys(mg.participants);
  mg.liarId = ids[Math.floor(Math.random() * ids.length)];
  mg.liarTopic = LIAR_WORDS_50[Math.floor(Math.random() * LIAR_WORDS_50.length)];
  mg.turnOrder = [...ids].sort(() => Math.random() - 0.5);
  mg.turnIndex = 0;
  mg.roundNum = 1;
  mg.speeches = [];
  mg.votes = {};
  mg.runoffIds = null;

  const radius = 5.5;
  mg.turnOrder.forEach((id, idx) => {
    const ang = (idx / mg.turnOrder.length) * Math.PI * 2;
    const p = mg.participants[id];
    p.x = Math.sin(ang) * radius;
    p.y = 0;
    p.z = Math.cos(ang) * radius;
    p.rotY = ang + Math.PI;
    p.isMoving = false;
  });

  mg.turnOrder.forEach(id => {
    if (!mg.participants[id].isCpu) {
      const isLiar = (id === mg.liarId);
      io.to(id).emit('liarGameStarted', {
        category: mg.liarTopic.cat,
        word: isLiar ? null : mg.liarTopic.word,
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

  if (mg.runoffIds) {
    if (mg.turnIndex >= mg.runoffIds.length) {
      startLiarVote(mg.runoffIds);
      return;
    }
    broadcastSpeakerTurn(mg.runoffIds[mg.turnIndex], '동점자 최후 변론');
    return;
  }

  if (mg.turnIndex >= mg.turnOrder.length) {
    if (mg.roundNum < 2) {
      mg.roundNum += 1;
      mg.turnIndex = 0;
    } else {
      startLiarVote(mg.turnOrder);
      return;
    }
  }

  broadcastSpeakerTurn(mg.turnOrder[mg.turnIndex], mg.roundNum + '바퀴째 발언');
}

function generateSmartCpuSpeech(cpuId) {
  const isLiar = (cpuId === mg.liarId);
  if (!isLiar) {
    const num = parseInt(cpuId.replace('cpu_', '') || '1');
    const idx = (mg.roundNum * 3 + mg.turnIndex + num) % mg.liarTopic.hints.length;
    return mg.liarTopic.hints[idx];
  } else {
    const crypticPool = [
      '분위기나 상황으로만 떠올리면 은근히 헷갈릴 수도 있을 것 같아요.',
      '앞에서 나온 이야기들을 들으면서 머릿속으로 그림을 그려보고 있어요.',
      '직접 마주했을 때 느껴지는 공기나 템포가 꽤 인상적인 주제네요.',
      '사람마다 받아들이는 포인트가 조금씩 다를 수 있는 대상이라고 생각해요.'
    ];
    return crypticPool[(mg.turnIndex + mg.roundNum) % crypticPool.length];
  }
}

function broadcastSpeakerTurn(speakerId, label) {
  let turnTime = 60;
  io.emit('liarTurnUpdate', {
    speakerId,
    speakerName: mg.participants[speakerId] ? mg.participants[speakerId].name : '',
    label,
    timeLeft: turnTime,
    speeches: mg.speeches
  });

  if (mg.participants[speakerId] && mg.participants[speakerId].isCpu) {
    setTimeout(() => {
      if (mg.phase !== 'liar_speak') return;
      recordLiarSpeech(speakerId, generateSmartCpuSpeech(speakerId));
    }, 3200);
    return;
  }

  mg.loopTimer = setInterval(() => {
    turnTime -= 1;
    io.emit('liarTurnTick', { timeLeft: turnTime });
    if (turnTime <= 0) {
      clearInterval(mg.loopTimer);
      recordLiarSpeech(speakerId, '(시간 초과로 발언하지 못했습니다)');
    }
  }, 1000);
}

function recordLiarSpeech(speakerId, text) {
  if (mg.loopTimer) clearInterval(mg.loopTimer);
  const p = mg.participants[speakerId];
  if (!p) return;

  const entry = { id: speakerId, name: p.name, text: text.trim().substring(0, 100) };
  mg.speeches.push(entry);
  io.emit('liarNewSpeech', { entry, speeches: mg.speeches });

  mg.turnIndex += 1;
  setTimeout(() => { if (mg.phase === 'liar_speak') advanceLiarTurn(); }, 2000);
}

function computeSmartCpuVote(voterId, candidateIds) {
  const others = candidateIds.filter(id => id !== voterId);
  if (others.length === 0) return candidateIds[0];

  const keywords = mg.liarTopic.kw || [];
  const suspicionScores = others.map(cid => {
    const userSpeeches = mg.speeches.filter(s => s.id === cid).map(s => s.text).join(' ');
    let score = 0;
    if (userSpeeches.includes('시간 초과') || userSpeeches.trim().length < 8) score += 45;
    let kwHits = 0;
    keywords.forEach(k => { if (userSpeeches.includes(k)) kwHits++; });
    if (kwHits === 0) score += 25;
    else score -= kwHits * 15;
    if (userSpeeches.includes('분위기') || userSpeeches.includes('그림을 그려') || userSpeeches.includes('조금씩 다를')) score += 25;
    score += Math.random() * 14;
    return { id: cid, score };
  });

  suspicionScores.sort((a, b) => b.score - a.score);
  return suspicionScores[0].id;
}

function startLiarVote(candidateIds) {
  mg.phase = 'liar_vote';
  mg.votes = {};
  let voteTime = 20;

  Object.values(mg.participants).forEach(p => {
    if (p.isCpu) mg.votes[p.id] = computeSmartCpuVote(p.id, candidateIds);
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
    if (Object.keys(mg.votes).length >= Object.keys(mg.participants).length || voteTime <= 0) {
      clearInterval(mg.loopTimer);
      resolveLiarVote(candidateIds);
    }
  }, 1000);
}

function resolveLiarVote(candidateIds) {
  const tally = {};
  candidateIds.forEach(id => tally[id] = 0);
  Object.values(mg.votes).forEach(targetId => { if (tally[targetId] !== undefined) tally[targetId] += 1; });

  const maxVotes = Math.max(...Object.values(tally));
  const topIds = candidateIds.filter(id => tally[id] === maxVotes);

  if (topIds.length > 1) {
    mg.phase = 'liar_speak';
    mg.runoffIds = topIds;
    mg.turnIndex = 0;
    const names = topIds.map(id => mg.participants[id] ? mg.participants[id].name : '').join(', ');
    io.emit('liarRunoffAnnounced', { tieNames: names });
    setTimeout(() => { if (mg.phase === 'liar_speak') advanceLiarTurn(); }, 2200);
    return;
  }

  const accusedId = topIds[0];
  const liarName = mg.participants[mg.liarId] ? mg.participants[mg.liarId].name : '알 수 없음';
  const accusedName = mg.participants[accusedId] ? mg.participants[accusedId].name : '알 수 없음';
  const caught = (accusedId === mg.liarId);

  let summaryText = '';
  if (caught) {
    Object.values(mg.participants).forEach(p => {
      if (p.id !== mg.liarId && !p.isCpu && players[p.id]) {
        players[p.id].mong = (players[p.id].mong || 0) + 200;
      }
    });
    summaryText = '🎉 라이어 검거 성공! 지목된 [' + accusedName + ']님이 라이어였습니다!<br>제시어: <b>' + mg.liarTopic.word + '</b> (' + mg.liarTopic.cat + ')<br>시민 전원 +200몽 지급!';
  } else {
    if (mg.participants[mg.liarId] && !mg.participants[mg.liarId].isCpu && players[mg.liarId]) {
      players[mg.liarId].mong = (players[mg.liarId].mong || 0) + 350;
    }
    summaryText = '😈 라이어 승리! 지목된 [' + accusedName + ']님은 시민이었습니다!<br>진짜 라이어: <b>' + liarName + '</b> / 제시어: <b>' + mg.liarTopic.word + '</b><br>라이어에게 +350몽 지급!';
  }

  io.emit('minigameEnded', {
    title: '🕵️ 거짓말 탐지기 결과',
    summaryText,
    updatedPlayers: players
  });
  resetMinigame();
}

io.on('connection', (socket) => {
  players[socket.id] = {
    id: socket.id,
    name: '플레이어_' + socket.id.substring(0, 4),
    mong: 200,
    speedLevel: 0,
    jumpLevel: 0,
    isAdmin: false,
    isInvisible: false,
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

  socket.emit('currentPlayers', { players, worldCoins: WORLD_COINS });
  socket.broadcast.emit('newPlayer', players[socket.id]);

  socket.on('adminLogin', ({ id, pw }) => {
    const p = players[socket.id];
    if (!p) return;
    if (id === ADMIN_ID && pw === ADMIN_PW) {
      p.isAdmin = true;
      p.mong = (p.mong || 0) + 1000;
      p.speedLevel = 20;
      p.jumpLevel = 20;
      p.ownedTops = [...ALL_TOPS];
      p.ownedBottoms = [...ALL_BOTTOMS];
      p.ownedThemes = [...ALL_THEMES];
      socket.emit('adminAuthSuccess', p);
      io.emit('playerUpdated', p);
    } else {
      socket.emit('adminAuthFail', '아이디 또는 비밀번호가 올바르지 않습니다.');
    }
  });

  socket.on('adminToggleInvisible', () => {
    const p = players[socket.id];
    if (!p || !p.isAdmin) return;
    p.isInvisible = !p.isInvisible;
    io.emit('adminPlayerStealth', { id: socket.id, isInvisible: p.isInvisible });
    socket.emit('adminAuthSuccess', p);
  });

  socket.on('adminKickUser', (targetId) => {
    const p = players[socket.id];
    if (!p || !p.isAdmin || !players[targetId] || targetId === socket.id) return;
    const kickedName = players[targetId].name;
    io.to(targetId).emit('adminKicked', { byName: p.name });
    const targetSocket = io.sockets.sockets.get(targetId);
    if (targetSocket) {
      targetSocket.disconnect(true);
    }
    delete players[targetId];
    io.emit('playerDisconnected', targetId);
    io.emit('adminGlobalAlert', {
      senderName: 'ADMIN',
      message: '[' + kickedName + '] 님이 관리자에 의해 월드에서 내보내졌습니다.'
    });
  });

  socket.on('adminBroadcastAlert', (alertText) => {
    const p = players[socket.id];
    if (!p || !p.isAdmin) return;
    const clean = (alertText || '').trim().substring(0, 120);
    if (!clean) return;
    io.emit('adminGlobalAlert', {
      senderName: p.name,
      message: clean
    });
  });

  socket.on('collectWorldCoin', (coinId) => {
    const p = players[socket.id];
    const coin = WORLD_COINS.find(c => c.id === coinId);
    if (!p || !coin || mg.phase === 'playing') return;
    if (Math.hypot(p.x - coin.x, p.z - coin.z) <= 2.6) {
      p.mong = (p.mong || 0) + 5;
      const nextPos = spawnCoinPosition(coinId);
      coin.x = nextPos.x;
      coin.z = nextPos.z;
      socket.emit('coinCollected', { mong: p.mong, earned: 5 });
      io.emit('worldCoinMoved', coin);
    }
  });

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
    const maxLv = p.isAdmin ? 20 : 5;
    if (category === 'speed' && p.speedLevel < maxLv) {
      const cost = (p.speedLevel + 1) * 50;
      if (p.mong >= cost) { p.mong -= cost; p.speedLevel += 1; socket.emit('shopUpdated', p); }
    } else if (category === 'jump' && p.jumpLevel < maxLv) {
      const cost = (p.jumpLevel + 1) * 50;
      if (p.mong >= cost) { p.mong -= cost; p.jumpLevel += 1; socket.emit('shopUpdated', p); }
    } else if (category === 'top') {
      const cost = SHOP_PRICES.tops[itemId] !== undefined ? SHOP_PRICES.tops[itemId] : 9999;
      if (!p.ownedTops.includes(itemId) && p.mong >= cost) {
        p.mong -= cost; p.ownedTops.push(itemId); p.topStyle = itemId;
        socket.emit('shopUpdated', p); io.emit('playerUpdated', p);
      }
    } else if (category === 'bottom') {
      const cost = SHOP_PRICES.bottoms[itemId] !== undefined ? SHOP_PRICES.bottoms[itemId] : 9999;
      if (!p.ownedBottoms.includes(itemId) && p.mong >= cost) {
        p.mong -= cost; p.ownedBottoms.push(itemId); p.bottomStyle = itemId;
        socket.emit('shopUpdated', p); io.emit('playerUpdated', p);
      }
    } else if (category === 'theme') {
      const cost = SHOP_PRICES.themes[itemId] !== undefined ? SHOP_PRICES.themes[itemId] : 9999;
      if (!p.ownedThemes.includes(itemId) && p.mong >= cost) {
        p.mong -= cost; p.ownedThemes.push(itemId); socket.emit('shopUpdated', p);
      }
    }
  });

  socket.on('exchangeTransfer', ({ targetId, mongAmount, giftTop }) => {
    const sender = players[socket.id];
    const receiver = players[targetId];
    if (!sender || !receiver || socket.id === targetId) return;

    const amt = Math.max(0, Math.min(sender.mong, parseInt(mongAmount) || 0));
    if (amt > 0) {
      sender.mong -= amt;
      receiver.mong += amt;
    }
    if (giftTop && sender.ownedTops.includes(giftTop) && !receiver.ownedTops.includes(giftTop)) {
      receiver.ownedTops.push(giftTop);
    }

    const giftText = giftTop ? (' 및 [' + giftTop + '] 의상') : '';
    socket.emit('shopUpdated', sender);
    io.to(targetId).emit('shopUpdated', receiver);
    io.to(targetId).emit('chatMessage', {
      id: 'system',
      name: '🏦 교환소 알림',
      text: sender.name + '님이 ' + amt + '몽' + giftText + '을 보냈습니다!'
    });
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
        name: players[socket.id] ? players[socket.id].name : '익명',
        text: msg.trim().substring(0, 100)
      });
    }
  });

  socket.on('requestStartLobby', ({ type, cpuCount, mode }) => {
    if (mg.phase === 'idle' && !mgLock) openMinigameLobby(socket.id, type, cpuCount, mode);
  });

  socket.on('hostForceStartLobby', () => {
    if (mg.phase === 'lobby' && socket.id === mg.hostId) onLobbyFinished();
  });

  socket.on('hostCancelLobby', () => {
    if (mg.phase === 'lobby' && socket.id === mg.hostId) {
      io.emit('minigameCancelled', { reason: '방장이 미니게임 모집을 취소했습니다.' });
      resetMinigame();
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
      const safeTeams = Math.max(2, Math.min(4, parseInt(teamCount) || 2));
      startColorFlipMatch(safeTeams, assignments);
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
  console.log('Server v1.6-20261122 running on port ' + PORT);
});
