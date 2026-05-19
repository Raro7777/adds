// 광고채널 성과 대시보드 — 메인 로직
// 스펙 v6.3 검토 문서 기반 (확정 3건 반영, 보류/대기 항목은 UI 노트 처리)

const state = {
  periodDays: 14,
  channelFilter: 'all',
  trimEnabled: true,
};

const fmt = {
  num: (n) => n == null ? 'N/A' : n.toLocaleString('ko-KR'),
  krw: (n) => n == null ? 'N/A' : '₩' + Math.round(n).toLocaleString('ko-KR'),
  pct: (n) => n == null ? 'N/A' : n.toFixed(2) + '%',
};

// === 탭 전환 ===
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b === btn));
    document.querySelectorAll('.tab-content').forEach(c => {
      c.classList.toggle('active', c.id === 'tab-' + tab);
    });
  });
});

// === 데이터 집계 ===
function getFilteredDaily() {
  const cutoff = new Date('2026-05-19T00:00:00+09:00');
  cutoff.setDate(cutoff.getDate() - state.periodDays + 1);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  return MOCK.DAILY.filter(row => {
    if (row.date < cutoffStr) return false;
    if (state.channelFilter !== 'all' && row.channelId !== state.channelFilter) return false;
    return true;
  });
}

// 채널 광고비 계산 (확정 사항 + §6-2 부가세/수수료 적용)
function channelCost(channelId, rows) {
  const ch = MOCK.CHANNELS.find(c => c.id === channelId);
  let base = 0;

  if (ch.type === 'A') {
    rows.forEach(r => {
      if (r.channelId !== channelId) return;
      base += MOCK.TYPE_A_DAILY_COST[r.date + '|' + r.channelId] || 0;
    });
  } else if (ch.type === 'B') {
    // §3-3-1: 배치 시점 단가 × 인입수
    rows.forEach(r => {
      if (r.channelId !== channelId) return;
      base += (ch.unitPrice || 0) * r.incoming;
    });
  } else if (ch.type === 'C') {
    // 월 광고비를 기간 비율로 환산 (데모용 단순화)
    const daysInPeriod = state.periodDays;
    base = (ch.monthlyBudget || 0) * (daysInPeriod / 30);
  }

  // §6-2 부가세/수수료
  const vat = MOCK.COST_CONFIG.vat;
  const com = MOCK.COST_CONFIG.commission;
  let multiplier = 1;
  if (vat.enabled) multiplier *= (1 + vat.rate);
  if (com.enabled) multiplier *= (1 + com.rate);

  return base * multiplier;
}

function aggregateByChannel(rows) {
  const map = {};
  const visibleChannels = state.channelFilter === 'all'
    ? MOCK.CHANNELS
    : MOCK.CHANNELS.filter(c => c.id === state.channelFilter);
  visibleChannels.forEach(ch => {
    map[ch.id] = {
      channel: ch,
      impressions: 0,
      clicks: 0,
      incoming: 0,
      hasImpression: false,
      hasClick: false,
    };
  });

  rows.forEach(r => {
    const m = map[r.channelId];
    if (!m) return;
    if (r.impressions != null) { m.impressions += r.impressions; m.hasImpression = true; }
    if (r.clicks != null) { m.clicks += r.clicks; m.hasClick = true; }
    m.incoming += r.incoming;
  });

  return Object.values(map).map(m => {
    const cost = channelCost(m.channel.id, rows);
    const cvr = m.hasClick && m.clicks > 0 ? (m.incoming / m.clicks * 100) : null;
    const cpi = m.incoming > 0 ? cost / m.incoming : null;
    return {
      ...m,
      impressions: m.hasImpression ? m.impressions : null,
      clicks: m.hasClick ? m.clicks : null,
      cost,
      cvr,
      cpi,
    };
  });
}

// 팀별 인입 배분 + §4-1 광고비 배분
function aggregateByTeam(rows) {
  const teamIncoming = {};
  MOCK.TEAMS.forEach(t => teamIncoming[t.id] = 0);
  let unmappedIncoming = 0;

  // 채널별 인입 단가 = 채널 광고비 / 채널 총 인입
  const channelTotals = {};
  MOCK.CHANNELS.forEach(ch => {
    const channelRows = rows.filter(r => r.channelId === ch.id);
    const totalIncoming = channelRows.reduce((s, r) => s + r.incoming, 0);
    const cost = channelCost(ch.id, rows);
    channelTotals[ch.id] = {
      totalIncoming,
      unitCost: totalIncoming > 0 ? cost / totalIncoming : 0,
    };
  });

  const teamCost = {};
  MOCK.TEAMS.forEach(t => teamCost[t.id] = 0);

  rows.forEach(r => {
    const dist = MOCK.TEAM_DIST[r.date + '|' + r.channelId];
    if (!dist) return;
    MOCK.TEAMS.forEach(t => {
      teamIncoming[t.id] += dist[t.id];
      teamCost[t.id] += dist[t.id] * channelTotals[r.channelId].unitCost;
    });
    unmappedIncoming += (dist.unmapped || 0);
  });

  return {
    teams: MOCK.TEAMS.map(t => ({
      team: t,
      incoming: teamIncoming[t.id],
      cost: teamCost[t.id],
      cpi: teamIncoming[t.id] > 0 ? teamCost[t.id] / teamIncoming[t.id] : null,
    })),
    unmappedIncoming,
  };
}

// === 렌더링: 탭 1 ===
let trendChart = null;

function renderDashboard() {
  const rows = getFilteredDaily();
  const byChannel = aggregateByChannel(rows);
  const totalCost = byChannel.reduce((s, c) => s + c.cost, 0);
  const totalIncoming = byChannel.reduce((s, c) => s + c.incoming, 0);
  const totalClicks = byChannel.reduce((s, c) => s + (c.clicks || 0), 0);
  const avgCpi = totalIncoming > 0 ? totalCost / totalIncoming : 0;
  const avgCvr = totalClicks > 0 ? (byChannel.reduce((s, c) => s + (c.clicks ? c.incoming : 0), 0) / totalClicks * 100) : null;

  document.getElementById('kpi-cost').textContent = fmt.krw(totalCost);
  document.getElementById('kpi-incoming').textContent = fmt.num(totalIncoming) + '건';
  document.getElementById('kpi-cpi').textContent = fmt.krw(avgCpi);
  document.getElementById('kpi-cvr').textContent = fmt.pct(avgCvr);

  // 채널 테이블
  const chTbody = document.getElementById('channel-tbody');
  chTbody.innerHTML = byChannel.map(c => `
    <tr>
      <td>${c.channel.name} <span class="badge badge-${c.channel.type}">${c.channel.type}</span></td>
      <td class="${c.impressions == null ? 'muted' : ''}">${fmt.num(c.impressions)}</td>
      <td class="${c.clicks == null ? 'muted' : ''}">${fmt.num(c.clicks)}</td>
      <td>${fmt.num(c.incoming)}</td>
      <td class="${c.cvr == null ? 'muted' : ''}">${fmt.pct(c.cvr)}</td>
      <td>${fmt.krw(c.cost)}</td>
      <td>${fmt.krw(c.cpi)}</td>
    </tr>
  `).join('');

  // 팀 테이블
  const teamAgg = aggregateByTeam(rows);
  const teamTbody = document.getElementById('team-tbody');
  teamTbody.innerHTML = teamAgg.teams.map(t => `
    <tr>
      <td>${t.team.name}</td>
      <td>${fmt.num(t.incoming)}</td>
      <td>${fmt.krw(t.cost)}</td>
      <td>${fmt.krw(t.cpi)}</td>
    </tr>
  `).join('');

  const unmappedEl = document.getElementById('unmapped-note');
  if (teamAgg.unmappedIncoming > 0) {
    unmappedEl.style.display = 'block';
    unmappedEl.innerHTML = `<strong>미매핑 상담원 인입 ${fmt.num(teamAgg.unmappedIncoming)}건</strong> — 상담원 등록 후 자동 반영됩니다. (§4-2 확정안)`;
  } else {
    unmappedEl.style.display = 'none';
  }

  // 차트
  renderTrendChart(rows);
}

function renderTrendChart(rows) {
  const dates = [...new Set(rows.map(r => r.date))].sort();
  const channels = state.channelFilter === 'all'
    ? MOCK.CHANNELS
    : MOCK.CHANNELS.filter(c => c.id === state.channelFilter);

  const palette = ['#2563eb', '#dc2626', '#059669', '#d97706', '#7c3aed', '#0891b2', '#be185d'];

  const datasets = channels.map((ch, idx) => {
    const data = dates.map(d => {
      const row = rows.find(r => r.date === d && r.channelId === ch.id);
      if (!row) return 0;
      const ratesMul = (MOCK.COST_CONFIG.vat.enabled ? 1.10 : 1) * (MOCK.COST_CONFIG.commission.enabled ? 1.05 : 1);
      if (ch.type === 'A') {
        return (MOCK.TYPE_A_DAILY_COST[d + '|' + ch.id] || 0) * ratesMul;
      } else if (ch.type === 'B') {
        return ch.unitPrice * row.incoming * ratesMul;
      } else {
        return (ch.monthlyBudget / 30) * ratesMul;
      }
    });
    return {
      label: ch.name,
      data,
      borderColor: palette[idx % palette.length],
      backgroundColor: palette[idx % palette.length] + '20',
      tension: 0.3,
      borderWidth: 2,
      pointRadius: 2,
    };
  });

  const ctx = document.getElementById('trend-chart').getContext('2d');
  if (trendChart) trendChart.destroy();
  trendChart = new Chart(ctx, {
    type: 'line',
    data: { labels: dates.map(d => d.slice(5)), datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } },
        tooltip: {
          callbacks: { label: (c) => c.dataset.label + ': ' + fmt.krw(c.parsed.y) },
        },
      },
      scales: {
        y: { ticks: { callback: (v) => '₩' + (v / 10000).toFixed(0) + '만' } },
      },
    },
  });
}

// === 렌더링: 탭 2 (광고비 설정) ===
function renderAdConfig() {
  const list = document.getElementById('channel-config-list');
  list.innerHTML = MOCK.CHANNELS.map(ch => {
    let control = '';
    if (ch.type === 'A') {
      control = `<span class="tag-warn">API 자동 수집</span>`;
    } else if (ch.type === 'B') {
      control = `
        <div>
          <input type="number" data-channel="${ch.id}" data-field="unitPrice" value="${ch.unitPrice}" />
          <span style="font-size: 12px; color: var(--color-muted);">원/건</span>
          <input type="date" value="2026-05-19" title="적용 시작일" />
        </div>
      `;
    } else if (ch.type === 'C') {
      control = `
        <input type="number" data-channel="${ch.id}" data-field="monthlyBudget" value="${ch.monthlyBudget}" />
        <span style="font-size: 12px; color: var(--color-muted);">원/월</span>
      `;
    }
    const note = ch.type === 'B'
      ? `<div class="formula-box">광고비 = 배치 시점 단가 × 인입수 (§3-3-1) · <span class="tag-warn">소급 정책 미확정</span></div>`
      : '';
    return `
      <div class="config-row">
        <div class="label-block">
          <div class="name">${ch.name} <span class="badge badge-${ch.type}">${ch.type}</span></div>
          <div class="desc">${ch.type === 'A' ? '광고 플랫폼 API에서 일자별 광고비 자동 수집' : ch.type === 'B' ? '단가 × 인입수로 일자별 계산' : '월 광고비 수동 입력'}</div>
          ${note}
        </div>
        <div>${control}</div>
      </div>
    `;
  }).join('');

  list.querySelectorAll('input[data-channel]').forEach(input => {
    input.addEventListener('change', e => {
      const ch = MOCK.CHANNELS.find(c => c.id === e.target.dataset.channel);
      ch[e.target.dataset.field] = Number(e.target.value);
      renderDashboard();
    });
  });

  // 부가세/수수료 토글
  document.getElementById('vat-toggle').checked = MOCK.COST_CONFIG.vat.enabled;
  document.getElementById('com-toggle').checked = MOCK.COST_CONFIG.commission.enabled;
}

document.getElementById('vat-toggle').addEventListener('change', e => {
  MOCK.COST_CONFIG.vat.enabled = e.target.checked;
  renderDashboard();
});
document.getElementById('com-toggle').addEventListener('change', e => {
  MOCK.COST_CONFIG.commission.enabled = e.target.checked;
  renderDashboard();
});

// === 렌더링: 탭 3 (팀·상담원) ===
function renderTeamConfig() {
  const trim = (s) => state.trimEnabled ? s.trim() : s;

  const unmapped = MOCK.AGENTS.filter(a => !a.teamId);
  const unmappedAlert = document.getElementById('unmapped-alert');
  if (unmapped.length > 0) {
    unmappedAlert.style.display = 'block';
    unmappedAlert.innerHTML = `
      <strong>⚠ 미매핑 상담원 ${unmapped.length}명</strong> — 전산에서 상담은 발생했으나 팀 매핑이 없는 상담원입니다.
      운영자가 등록·수정하면 다음 배치부터 자동 반영됩니다. (§4-2 확정안)
      <div style="margin-top: 6px;">대상: ${unmapped.map(a => `"${trim(a.name)}"`).join(', ')}</div>
    `;
  } else {
    unmappedAlert.style.display = 'none';
  }

  const teamList = document.getElementById('team-list');
  teamList.innerHTML = MOCK.TEAMS.map(t => {
    const agents = MOCK.AGENTS.filter(a => a.teamId === t.id);
    return `
      <div class="team-card">
        <h4>${t.name} <span style="font-size: 11px; color: var(--color-muted); font-weight: normal;">(${agents.length}명)</span></h4>
        ${agents.map(a => `<div class="agent">${trim(a.name)}</div>`).join('')}
      </div>
    `;
  }).join('');

  // Trim 데모
  const demoTarget = MOCK.AGENTS.find(a => a.name !== a.name.trim());
  if (demoTarget) {
    document.getElementById('trim-demo').innerHTML = `
      <span>입력값: <code>"${demoTarget.name}"</code></span>
      <span class="arrow">→</span>
      <span>저장: <code>"${state.trimEnabled ? demoTarget.name.trim() : demoTarget.name}"</code></span>
    `;
  }
}

document.getElementById('trim-toggle').addEventListener('change', e => {
  state.trimEnabled = e.target.checked;
  renderTeamConfig();
});

// === 필터 ===
document.getElementById('period-filter').addEventListener('change', e => {
  state.periodDays = Number(e.target.value);
  renderDashboard();
});

document.getElementById('channel-filter').addEventListener('change', e => {
  state.channelFilter = e.target.value;
  renderDashboard();
});

// 채널 필터 옵션 채우기
const channelFilter = document.getElementById('channel-filter');
MOCK.CHANNELS.forEach(ch => {
  const opt = document.createElement('option');
  opt.value = ch.id;
  opt.textContent = ch.name + ' (' + ch.type + ')';
  channelFilter.appendChild(opt);
});

// === 초기 렌더 ===
renderDashboard();
renderAdConfig();
renderTeamConfig();
