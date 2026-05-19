// 광고채널 성과 대시보드 — Mock 데이터
// 스펙 v6.3 검토 문서 기반 (2026-05-19)

const CHANNELS = [
  { id: 'naver',  name: '네이버',  type: 'A', unitPrice: null,  monthlyBudget: null },
  { id: 'kakao',  name: '카카오',  type: 'A', unitPrice: null,  monthlyBudget: null },
  { id: 'google', name: '구글',    type: 'A', unitPrice: null,  monthlyBudget: null },
  { id: 'meta',   name: 'Meta',    type: 'A', unitPrice: null,  monthlyBudget: null },
  { id: 'blog',   name: '블로그체험단', type: 'B', unitPrice: 25000, monthlyBudget: null },
  { id: 'cafe',   name: '카페제휴',    type: 'B', unitPrice: 18000, monthlyBudget: null },
  { id: 'offline', name: '오프라인 광고', type: 'C', unitPrice: null, monthlyBudget: 3000000 },
];

const TEAMS = [
  { id: 't1', name: '영업1팀' },
  { id: 't2', name: '영업2팀' },
  { id: 't3', name: '영업3팀' },
];

const AGENTS = [
  { id: 'a01', name: '김민수',  teamId: 't1' },
  { id: 'a02', name: '이서연',  teamId: 't1' },
  { id: 'a03', name: '박지훈',  teamId: 't1' },
  { id: 'a04', name: '최예린',  teamId: 't2' },
  { id: 'a05', name: '정우진',  teamId: 't2' },
  { id: 'a06', name: '강하은',  teamId: 't2' },
  { id: 'a07', name: '윤도현',  teamId: 't3' },
  { id: 'a08', name: '임수아',  teamId: 't3' },
  { id: 'a09', name: '한지원',  teamId: 't3' },
  // 미매핑 상담원 (§4-2 케이스 B — 알림 표시 후 등록 시 자동 반영)
  { id: 'a10', name: ' 송가영 ', teamId: null }, // 앞뒤 공백 — trim 데모용
  { id: 'a11', name: '오시현',   teamId: null },
];

// 최근 14일 채널×일자별 인입/클릭/노출 데이터
// 타입 B/C 채널은 노출/클릭 null (§3-3 인입율 N/A 정책)
function generateDailyData() {
  const days = 14;
  const today = new Date('2026-05-19T00:00:00+09:00');
  const out = [];

  const seedFactors = {
    naver: { imp: 18000, clk: 850, inc: 42 },
    kakao: { imp: 12000, clk: 520, inc: 28 },
    google: { imp: 22000, clk: 1100, inc: 55 },
    meta: { imp: 9500, clk: 380, inc: 18 },
    blog: { imp: null, clk: null, inc: 12 },
    cafe: { imp: null, clk: null, inc: 8 },
    offline: { imp: null, clk: null, inc: 6 },
  };

  // 채널×일자별 결정적 변동(시드값 + 요일 가중)
  for (let d = days - 1; d >= 0; d--) {
    const date = new Date(today);
    date.setDate(today.getDate() - d);
    const dow = date.getDay();
    const weekendBoost = (dow === 0 || dow === 6) ? 0.85 : 1.0;
    const wave = 0.9 + 0.2 * Math.sin((days - d) * 0.7);

    CHANNELS.forEach(ch => {
      const s = seedFactors[ch.id];
      const factor = weekendBoost * wave;
      out.push({
        date: date.toISOString().slice(0, 10),
        channelId: ch.id,
        impressions: s.imp ? Math.round(s.imp * factor) : null,
        clicks: s.clk ? Math.round(s.clk * factor) : null,
        incoming: Math.round(s.inc * factor),
      });
    });
  }
  return out;
}

const DAILY = generateDailyData();

// 인입의 팀 배분 (각 인입을 상담원에게 할당 → 팀별 합산)
// 데모 단순화: 채널별 인입을 팀에 6:3:1 비중으로 분배 + 미매핑 약간
function generateTeamDistribution() {
  const teamShare = { t1: 0.45, t2: 0.35, t3: 0.18, unmapped: 0.02 };
  const result = {};
  DAILY.forEach(row => {
    const key = row.date + '|' + row.channelId;
    const dist = {};
    let allocated = 0;
    Object.entries(teamShare).forEach(([tid, share], idx, arr) => {
      if (idx === arr.length - 1) {
        dist[tid] = row.incoming - allocated;
      } else {
        const v = Math.round(row.incoming * share);
        dist[tid] = v;
        allocated += v;
      }
    });
    result[key] = dist;
  });
  return result;
}

const TEAM_DIST = generateTeamDistribution();

// 타입 A 채널의 일자별 광고비 (API에서 받아오는 가정)
const TYPE_A_DAILY_COST = {};
DAILY.forEach(row => {
  const ch = CHANNELS.find(c => c.id === row.channelId);
  if (ch.type !== 'A') return;
  const cpcRange = { naver: 320, kakao: 280, google: 410, meta: 250 };
  const cpc = cpcRange[ch.id];
  TYPE_A_DAILY_COST[row.date + '|' + row.channelId] = row.clicks * cpc;
});

// 부가세/수수료 설정 (탭 2에서 토글)
const COST_CONFIG = {
  vat: { enabled: true, rate: 0.10 },         // 10%
  commission: { enabled: true, rate: 0.05 },  // 5%
};

window.MOCK = {
  CHANNELS, TEAMS, AGENTS, DAILY, TEAM_DIST, TYPE_A_DAILY_COST, COST_CONFIG,
};
