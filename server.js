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

// 월드 바닥 황금 몽 코인 20개 (+5몽)
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

// 거짓말 탐지기 50개 구체적 제시어 + CPU용 구체적 힌트 + 키워드
const LIAR_WORDS_50 = [
  { cat: '음식', word: '짜장면', kw: ['검은', '춘장', '면', '단무지', '배달'], hints: ['검은 춘장 소스에 쫄깃한 면발을 비벼 먹는 국민 배달음식이에요', '중국집에서 시키면 노란 단무지랑 양파가 꼭 같이 와요', '졸업식이나 이사하는 날에 다 같이 시켜 먹기 딱 좋아요'] },
  { cat: '음식', word: '떡볶이', kw: ['빨간', '매운', '떡', '어묵', '분식'], hints: ['빨간 고추장 양념에 말랑한 떡과 어묵이 들어간 분식이에요', '학교 끝나고 친구들이랑 분식집에서 자주 사 먹는 매콤달콤한 메뉴예요', '튀김이나 순대를 국물에 찍어 먹으면 훨씬 맛있어요'] },
  { cat: '음식', word: '치킨', kw: ['닭', '튀김', '바삭', '야식', '배달'], hints: ['겉은 바삭하고 속은 촉촉하게 튀겨낸 야식의 제왕이에요', '후라이드랑 양념 반반으로 시켜 먹는 사람들이 정말 많아요', '무 피클이랑 콜라를 곁들여 먹으면 느끼함이 싹 사라져요'] },
  { cat: '음식', word: '피자', kw: ['치즈', '둥근', '조각', '오븐', '도우는'], hints: ['둥근 도우 위에 토마토 소스와 치즈를 듬뿍 올려 오븐에 구워요', '삼각형 모양으로 여덟 조각을 나눠서 손으로 들고 먹어요', '치즈가 쭉 늘어날 때 뜨겁게 먹으면 제일 맛있어요'] },
  { cat: '음식', word: '라면', kw: ['국물', '면', '냄비', '김치', '스프'], hints: ['끓는 물에 스프와 꼬불꼬불한 면을 넣고 3~4분 끓여 먹어요', '계란을 풀거나 잘 익은 김치를 얹어 먹으면 최고예요', '밤늦게 배고플 때 냄비 뚜껑에 덜어 먹는 맛이 일품이에요'] },
  { cat: '음식', word: '초밥', kw: ['생선', '밥', '와사비', '간장', '회'], hints: ['식초로 간을 한 작은 밥 덩어리 위에 신선한 생선회를 올려요', '간장에 살짝 찍어 먹는데 코가 찡한 와사비가 들어가요', '회전 레일 위에서 접시를 골라 먹는 식당도 인기가 많아요'] },
  { cat: '음식', word: '김밥', kw: ['김', '밥', '소풍', '단무지', '말아'], hints: ['검은 김 위에 밥과 시금치, 당근, 햄을 올려 돌돌 말아 썰어요', '어릴 때 소풍이나 운동회 갈 때 도시락으로 꼭 싸가던 메뉴예요', '한 입 크기로 동그랗게 썰려 있어서 간편하게 집어 먹기 좋아요'] },
  { cat: '음식', word: '삼겹살', kw: ['고기', '불판', '상추', '쌈', '구워'], hints: ['불판 위에 올려 지글지글 구워 먹는 고소한 돼지고기 부위예요', '상추나 깻잎에 마늘과 쌈장을 올려 한 입에 싸 먹어요', '기름이 지글지글 나올 때 김치도 같이 구워 먹으면 환상적이에요'] },
  { cat: '음식', word: '아이스크림', kw: ['차가운', '달콤', '여름', '녹아', '콘'], hints: ['입에 넣으면 사르르 녹아내리는 차갑고 달콤한 디저트예요', '바삭한 콘이나 컵에 여러 가지 맛을 골라 담아 먹어요', '무더운 여름날 더위를 식히기 위해 가장 먼저 찾게 돼요'] },
  { cat: '음식', word: '햄버거', kw: ['빵', '패티', '감자튀김', '양상추', '패스트푸드'], hints: ['동그란 빵 사이에 구운 고기 패티와 양상추, 치즈를 끼워 넣었어요', '세트 메뉴로 시키면 짭짤한 감자튀김이랑 콜라가 같이 나와요', '손으로 꾹 눌러서 크게 한 입 베어 먹는 패스트푸드예요'] },
  { cat: '동물', word: '강아지', kw: ['멍멍', '산책', '꼬리', '주인', '반려'], hints: ['주인이 집에 돌아오면 꼬리를 힘차게 흔들며 반겨주는 동물이에요', '하루에 한 번씩 목줄을 매고 밖으로 산책 나가는 걸 제일 좋아해요', '멍멍 짖기도 하고 앉아나 손 같은 훈련을 잘 따라해요'] },
  { cat: '동물', word: '고양이', kw: ['야옹', '털', '높은', '그루밍', '발톱'], hints: ['발소리가 거의 안 나고 높은 캣타워 위에 올라가 쉬는 걸 좋아해요', '혀로 자기 털을 핥아 씻는 그루밍을 자주 하는 깔끔한 동물이에요', '야옹 하고 울면서 기분이 좋으면 목에서 골골송을 불러요'] },
  { cat: '동물', word: '코끼리', kw: ['코', '큰', '귀', '상아', '육지'], hints: ['육지에 사는 동물 중 덩치가 가장 크고 긴 코를 손처럼 써요', '부채처럼 커다란 귀를 펄럭이며 더운 몸의 열을 식혀요', '긴 코로 물을 빨아들여서 자기 등에 샤워하듯 뿌리기도 해요'] },
  { cat: '동물', word: '기린', kw: ['목', '키', '무늬', '나뭇잎', '아프리카'], hints: ['세상에서 목이 가장 길어서 높은 나무 꼭대기의 잎을 뜯어 먹어요', '온몸에 갈색 그물 모양의 독특한 얼룩무늬가 퍼져 있어요', '다리가 아주 길어서 물 마실 때는 앞다리를 넓게 벌려야 해요'] },
  { cat: '동물', word: '펭귄', kw: ['남극', '얼음', '뒤뚱', '수영', '새'], hints: ['날개가 있지만 하늘을 날지 못하고 대신 바닷속에서 수영을 엄청 잘해요', '남극의 추운 빙하 위에서 배를 깔고 미끄럼 타듯 이동해요', '검은색과 흰색 턱시도를 입은 것처럼 보이고 뒤뚱뒤뚱 걸어요'] },
  { cat: '동물', word: '사자', kw: ['갈기', '왕', '초원', '어흥', '맹수'], hints: ['수컷의 목 주변에 풍성하고 멋진 갈기가 있어서 동물의 왕이라 불려요', '아프리카 초원에서 무리를 지어 생활하는 강력한 맹수예요', '어흥 하고 크게 포효하면 몇 킬로미터 밖에서도 들릴 정도예요'] },
  { cat: '동물', word: '토끼', kw: ['귀', '당근', '깡총', '하얀', '앞니'], hints: ['길쭉한 두 귀가 쫑긋 서 있고 깡총깡총 뛰어다니는 귀여운 동물이에요', '앞니가 톡 튀어나와 있어서 아삭한 당근이나 풀을 잘 갉아먹어요', '동화 속에서 거북이랑 달리기 경주를 하다가 낮잠을 자기도 해요'] },
  { cat: '동물', word: '판다', kw: ['대나무', '흑백', '눈', '중국', '곰'], hints: ['온몸이 하얀색과 검은색으로 되어 있고 눈 주위가 까만 다크서클 같아요', '하루 종일 앉아서 싱싱한 대나무 잎과 줄기를 우적우적 씹어 먹어요', '데굴데굴 구르는 모습이 사랑스러워서 동물원에서 인기가 최고예요'] },
  { cat: '동물', word: '돌고래', kw: ['바다', '점프', '초음파', '지능', '수영'], hints: ['바다 위를 힘차게 뛰어오르며 무리 지어 헤엄치는 똑똑한 동물이에요', '초음파를 쏴서 물속의 물고기 위치나 장애물을 정확히 파악해요', '사람에게 친근하고 입꼬리가 올라가서 항상 웃는 얼굴처럼 보여요'] },
  { cat: '동물', word: '다람쥐', kw: ['도토리', '볼', '나무', '줄무늬', '겨울'], hints: ['등에 갈색 줄무늬가 있고 도토리를 양쪽 볼에 빵빵하게 넣고 다녀요', '겨울잠을 대비해서 땅속이나 나무 구멍에 먹이를 숨겨 놓아요', '작고 재빨라서 나무 줄기를 순식간에 타고 올라가요'] },
  { cat: '스포츠', word: '축구', kw: ['발', '골대', '잔디', '월드컵', '11명'], hints: ['골키퍼를 제외한 선수들이 오직 발과 머리로만 공을 다루는 경기예요', '11명이 한 팀을 이루어 넓은 잔디밭에서 골대에 공을 넣어요', '4년마다 열리는 월드컵에서 전 세계가 열광하는 스포츠예요'] },
  { cat: '스포츠', word: '농구', kw: ['손', '드리블', '덩크', '골대', '코트'], hints: ['주황색 공을 바닥에 튕기며 드리블해서 높은 링 안에 넣는 경기예요', '키가 큰 선수들이 뛰어올라 링에 공을 꽂아 넣는 덩크슛이 멋져요', '3점 라인 밖에서 슛을 성공시키면 한 번에 3점을 얻어요'] },
  { cat: '스포츠', word: '야구', kw: ['배트', '홈런', '투수', '글러브', '9회'], hints: ['투수가 던진 공을 타자가 방망이로 힘껏 쳐서 베이스를 도는 경기예요', '공이 담장을 훌쩍 넘어가면 관중들이 환호하는 홈런이 돼요', '수비할 때는 손에 가죽 글러브를 끼고 날아오는 공을 잡아요'] },
  { cat: '스포츠', word: '배드민턴', kw: ['셔틀콕', '라켓', '네트', '깃털', '스매시'], hints: ['가벼운 라켓으로 깃털 달린 셔틀콕을 네트 너머로 쳐 넘기는 운동이에요', '공이 땅에 떨어지기 전에 빠르게 받아쳐야 해서 순발력이 중요해요', '동네 공원이나 체육관에서 남녀노소 누구나 쉽게 즐길 수 있어요'] },
  { cat: '스포츠', word: '수영', kw: ['물', '레인', '자유형', '수경', '호흡'], hints: ['물안경과 수영모를 쓰고 파란 물속을 팔다리로 저어 나가는 운동이에요', '자유형, 배영, 평영, 접영 네 가지 영법으로 속도를 겨뤄요', '물속에서 숨을 쉬는 호흡법과 발차기 리듬이 아주 중요해요'] },
  { cat: '스포츠', word: '태권도', kw: ['발차기', '도복', '띠', '품새', '격파'], hints: ['하얀 도복을 입고 허리에 실력별 색깔 띠를 매는 우리나라 전통 무술이에요', '화려한 돌려차기와 뛰어 앞차기 같은 발차기 기술이 핵심이에요', '송판을 손이나 발로 힘껏 쳐서 부수는 격파 시범이 멋져요'] },
  { cat: '스포츠', word: '탁구', kw: ['작은', '공', '테이블', '라켓', '핑퐁'], hints: ['초록색이나 파란색 테이블 위에서 가벼운 작은 공을 주고받는 경기예요', '공이 톡톡 튀는 소리가 경쾌해서 핑퐁이라고도 불려요', '스핀을 강하게 걸어 서브를 넣으면 상대방이 받기 아주 까다로워요'] },
  { cat: '스포츠', word: '스키', kw: ['눈', '겨울', '슬로프', '플레이트', '리프트'], hints: ['겨울철 하얀 눈이 쌓인 산비탈을 긴 판 두 개를 신고 미끄러져 내려와요', '양손에 폴을 짚고 리프트를 타고 정상까지 올라가서 활강해요', '초급, 중급, 상급 슬로프 코스를 골라 짜릿한 속도감을 즐겨요'] },
  { cat: '스포츠', word: '양궁', kw: ['활', '화살', '과녁', '10점', '집중'], hints: ['활시위를 당겨 멀리 있는 원형 과녁의 정중앙을 맞히는 경기예요', '바람의 방향을 계산하고 숨을 멈춘 채 고도의 집중력을 발휘해야 해요', '정중앙 노란 원에 화살이 꽂히면 최고 점수인 10점을 받아요'] },
  { cat: '스포츠', word: '볼링', kw: ['핀', '스트라이크', '무거운', '레인', '구멍'], hints: ['손가락 구멍이 세 개 뚫린 무거운 공을 굴려 10개의 핀을 쓰러뜨려요', '한 번에 열 개의 핀을 모두 쓰러뜨리면 짜릿한 스트라이크가 나와요', '전용 신발로 갈아 신고 매끄러운 나무 레인 끝을 향해 공을 굴려요'] },
  { cat: '악기', word: '피아노', kw: ['건반', '페달', '양손', '클래식', '검은'], hints: ['하얀 건반과 검은 건반이 나란히 놓여 있어 손가락으로 눌러 연주해요', '발로 아래 페달을 밟으면 소리가 길게 울리거나 부드러워져요', '오른손으로 멜로디를 치고 왼손으로 반주를 동시에 넣을 수 있어요'] },
  { cat: '악기', word: '바이올린', kw: ['활', '어깨', '턱', '현악기', '4줄'], hints: ['왼쪽 어깨와 턱 사이에 끼우고 오른손에 든 활로 네 줄을 그어 연주해요', '오케스트라에서 가장 높고 화려한 주선율을 담당하는 현악기예요', '지판에 칸이 없어서 정확한 음정을 잡으려면 귀와 손가락 연습이 필수예요'] },
  { cat: '악기', word: '기타', kw: ['줄', '코드', '피크', '통', '밴드'], hints: ['여섯 개의 줄을 왼손으로 코드를 잡고 오른손이나 피크로 튕겨 연주해요', '캠프파이어에서 노래 부를 때나 록 밴드 무대에서 빠지지 않아요', '나무 울림통이 있는 어쿠스틱과 앰프에 연결하는 일렉 종류가 있어요'] },
  { cat: '악기', word: '드럼', kw: ['스틱', '박자', '북', '심벌즈', '리듬'], hints: ['양손에 나무 스틱을 쥐고 여러 개의 북과 심벌즈를 두드려 리듬을 만들어요', '발로 페달을 밟아 쿵쿵 울리는 베이스 소리를 동시에 내야 해요', '밴드 연주에서 전체 곡의 박자와 에너지를 책임지는 타악기예요'] },
  { cat: '악기', word: '플루트', kw: ['입김', '옆으로', '은색', '관악기', '맑은'], hints: ['반짝이는 은색 금속 관을 입 옆으로 길게 들고 바람을 불어 소리 내요', '새가 지저귀는 것처럼 아주 맑고 청아한 고음 소리가 매력적이에요', '손가락으로 작은 은색 키들을 누르며 음높이를 조절해요'] },
  { cat: '장소', word: '학교', kw: ['교실', '선생님', '수업', '칠판', '친구'], hints: ['아침마다 가방을 메고 가서 친구들과 수업을 듣고 급식을 먹는 곳이에요', '교실 앞 칠판 앞에서 선생님이 설명해 주시고 쉬는 시간 종이 울려요', '운동장에서 체육 시간이나 축제를 하며 추억을 쌓는 공간이에요'] },
  { cat: '장소', word: '놀이공원', kw: ['롤러코스터', '퍼레이드', '티켓', '기구', '회전목마'], hints: ['짜릿한 롤러코스터와 예쁜 회전목마를 타며 하루 종일 노는 곳이에요', '머리띠를 쓰고 다니며 밤에는 화려한 퍼레이드와 불꽃놀이를 구경해요', '인기 있는 기구를 타려면 줄을 길게 서서 기다려야 해요'] },
  { cat: '장소', word: '도서관', kw: ['책', '조용히', '대출', '공부', '열람실'], hints: ['수많은 책이 분야별로 꽂혀 있어서 조용히 책을 읽거나 빌려가는 곳이에요', '떠들지 않고 발소리를 죽여야 하며 시험 기간엔 공부하는 사람이 많아요', '회원증을 찍으면 원하는 책을 집으로 며칠 동안 대출해 갈 수 있어요'] },
  { cat: '장소', word: '영화관', kw: ['팝콘', '스크린', '어두운', '예매', '콜라'], hints: ['고소한 팝콘과 콜라를 들고 어두운 상영관의 큰 스크린을 보는 곳이에요', '좌석 번호를 미리 예매하고 들어가서 상영 중에는 휴대폰을 꺼야 해요', '웅장한 사운드와 함께 최신 개봉작을 생생하게 감상할 수 있어요'] },
  { cat: '장소', word: '병원', kw: ['의사', '진료', '약', '주사', '간호사'], hints: ['몸이 아프거나 다쳤을 때 의사 선생님께 진료를 받으러 가는 곳이에요', '청진기로 진찰을 받고 처방전을 받아서 약국에서 약을 타요', '대기실에서 자기 이름이 불릴 때까지 기다리며 주사 맞을까 봐 떨려요'] },
  { cat: '물건', word: '스마트폰', kw: ['화면', '터치', '충전', '앱', '카메라'], hints: ['손바닥 안에 쏙 들어오며 화면을 터치해서 연락과 게임을 모두 해결해요', '배터리가 다 닳으면 충전 케이블을 꽂아 전기를 채워줘야 해요', '사진도 찍고 영상도 보며 현대인이 하루 종일 손에서 놓지 않는 기기예요'] },
  { cat: '물건', word: '우산', kw: ['비', '펼쳐', '손잡이', '장마', '젖지'], hints: ['하늘에서 비가 내릴 때 머리 위로 활짝 펼쳐서 몸이 젖지 않게 막아줘요', '비가 그치면 물기를 털어내고 돌돌 말아 똑딱이 단추로 접어둬요', '강풍이 불면 가끔 뒤집어지기도 하고 버스에 깜빡 두고 내리기 쉬워요'] },
  { cat: '물건', word: '시계', kw: ['시간', '바늘', '숫자', '손목', '알람'], hints: ['시침과 분침이 계속 돌아가며 지금이 몇 시 몇 분인지 정확히 알려줘요', '손목에 차고 다니거나 방 벽에 걸어두고 약속 시간을 확인해요', '아침에 늦잠 자지 않도록 정해진 시각에 알람을 울려 깨워줘요'] },
  { cat: '물건', word: '거울', kw: ['얼굴', '반사', '외출', '유리', '모습'], hints: ['앞에 서면 내 얼굴과 옷차림이 좌우가 바뀌어 그대로 비쳐 보이는 물건이에요', '아침에 외출하기 전에 머리가 헝클어지지 않았는지 꼭 확인해요', '유리 뒷면에 빛을 반사하는 코팅이 되어 있어서 화장실이나 방에 꼭 있어요'] },
  { cat: '물건', word: '자전거', kw: ['바퀴', '페달', '핸들', '안장', '헬멧'], hints: ['두 바퀴로 균형을 잡으며 발로 페달을 밟아 앞으로 나아가는 탈것이에요', '안장에 앉아 양손으로 핸들을 잡고 브레이크를 당겨 속도를 줄여요', '한강 공원이나 전용 도로를 달릴 때 시원한 바람을 느낄 수 있어요'] },
  { cat: '직업', word: '소방관', kw: ['불', '사이렌', '물', '구조', '소방차'], hints: ['화재가 발생하면 빨간 차를 타고 사이렌을 울리며 출동해 불을 꺼요', '방화복을 입고 위험한 현장에 들어가 사람들을 안전하게 구조해요', '119 신고가 들어오면 밤낮없이 가장 먼저 달려가는 영웅 같은 직업이에요'] },
  { cat: '직업', word: '경찰관', kw: ['범인', '순찰', '112', '제복', '안전'], hints: ['파란 제복을 입고 동네를 순찰하며 시민들의 안전과 질서를 지켜요', '나쁜 범인을 잡거나 교통정리를 하며 112 신고를 받고 출동해요', '도움이 필요한 사람이나 길을 잃은 아이를 안전하게 도와줘요'] },
  { cat: '직업', word: '요리사', kw: ['주방', '칼', '프라이팬', '레시피', '맛있는'], hints: ['앞치마와 높은 모자를 쓰고 주방에서 신선한 재료로 맛있는 음식을 만들어요', '불 조절과 칼질 솜씨가 뛰어나며 새로운 메뉴 레시피를 연구해요', '손님들이 자기가 만든 음식을 맛있게 먹고 웃을 때 가장 보람을 느껴요'] },
  { cat: '직업', word: '우주비행사', kw: ['로켓', '우주복', '무중력', '달', '정거장'], hints: ['커다란 로켓을 타고 지구를 떠나 둥둥 떠다니는 무중력 공간에서 임무를 해요', '하얀 우주복과 헬멧을 쓰고 우주정거장에서 과학 실험을 진행해요', '까만 우주 밖에서 푸른 지구를 직접 내려다볼 수 있는 멋진 직업이에요'] },
  { cat: '직업', word: '선생님', kw: ['학생', '수업', '칠판', '가르쳐', '학교'], hints: ['교실에서 학생들에게 여러 과목의 지식과 바른 생활을 가르쳐 주세요', '시험 문제를 내고 채점하며 고민이 있는 학생들과 상담도 해주세요', '분필이나 마커를 들고 칠판에 중요한 내용을 정리해 주시는 분이에요'] }
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
  mg.timeLeft = 90; // 1분 30초

  const count = Object.keys(mg.participants).length;
  mg.arenaHalfSize = Math.min(33, 18 + Math.floor(count * 1.1));
  const spawnLim = mg.arenaHalfSize - 2.5;

  Object.values(mg.participants).forEach(p => {
    const isIt = itIds.includes(p.id);
    p.role = isIt ? 'it' : 'runner';
    p.status = 'normal';
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
        if (p.status === 'frozen' || p.status === 'out') { p.isMoving = false; return; }
        p.isMoving = true;
        const nearIt = its.find(it => Math.hypot(it.x - p.x, it.z - p.z) < 3.2);
        if (nearIt && p.freezeCooldown <= 0) {
          p.status = 'frozen'; p.isMoving = false;
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
            frozenMate.status = 'normal'; frozenMate.freezeCooldown = 2.0;
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

    its.forEach(it => {
      runners.forEach(r => {
        if (r.status === 'normal' && Math.hypot(it.x - r.x, it.z - r.z) < 1.55) {
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
    const idx = (mg.roundNum * 2 + mg.turnIndex + num) % mg.liarTopic.hints.length;
    return mg.liarTopic.hints[idx];
  } else {
    const prevTexts = mg.speeches.map(s => s.text).join(' ');
    if (prevTexts.length === 0) {
      return '일상생활에서 정말 친숙하고 많은 사람들이 좋아하는 ' + mg.liarTopic.cat + ' 관련이에요.';
    }
    if (mg.liarTopic.cat === '음식') return '앞분 말씀처럼 호불호가 거의 없고 식사나 간식으로 생각날 때 자주 찾는 메뉴예요.';
    if (mg.liarTopic.cat === '동물') return '생김새나 행동이 정말 매력적이고 특징이 뚜렷해서 누구나 바로 떠올릴 수 있어요.';
    if (mg.liarTopic.cat === '스포츠') return '규칙이 흥미진진하고 친구들이랑 같이 하거나 경기를 보면 정말 재미있는 종목이에요.';
    if (mg.liarTopic.cat === '악기') return '연주하는 모습을 보면 정말 멋지고 아름다운 소리가 나서 인기 있는 악기예요.';
    if (mg.liarTopic.cat === '장소') return '주말이나 평일에 사람들이 목적을 가지고 자주 방문하는 아주 익숙한 공간이에요.';
    if (mg.liarTopic.cat === '직업') return '우리 사회에서 꼭 필요한 중요한 역할을 맡고 있어서 존경받는 멋진 직업이에요.';
    return '주변에서 쉽게 접할 수 있고 특징이 아주 분명해서 설명하기 좋은 주제예요.';
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
    if (userSpeeches.includes('시간 초과') || userSpeeches.trim().length < 6) score += 50;
    let kwHits = 0;
    keywords.forEach(k => { if (userSpeeches.includes(k)) kwHits++; });
    if (kwHits === 0) score += 35;
    else score -= kwHits * 15;
    if (userSpeeches.includes('친숙') || userSpeeches.includes('매력적') || userSpeeches.includes('익숙한')) score += 20;
    score += Math.random() * 12;
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
    if (category === 'speed' && p.speedLevel < 5) {
      const cost = (p.speedLevel + 1) * 50;
      if (p.mong >= cost) { p.mong -= cost; p.speedLevel += 1; socket.emit('shopUpdated', p); }
    } else if (category === 'jump' && p.jumpLevel < 5) {
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
