"use client";

import { useState } from "react";

type TabKey = "dashboard" | "adspend" | "team";

const TABS: { key: TabKey; label: string }[] = [
  { key: "dashboard", label: "대시보드" },
  { key: "adspend", label: "광고비 설정" },
  { key: "team", label: "팀·상담원 구성" },
];

export default function Page() {
  const [tab, setTab] = useState<TabKey>("dashboard");

  return (
    <main style={styles.main}>
      <header style={styles.header}>
        <h1 style={styles.title}>광고채널 성과 대시보드</h1>
        <p style={styles.subtitle}>v6.3 · 1시간 단위 배치 재집계 · KST</p>
      </header>

      <nav style={styles.tabs}>
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              ...styles.tab,
              ...(tab === t.key ? styles.tabActive : null),
            }}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <section style={styles.panel}>
        {tab === "dashboard" && <DashboardPanel />}
        {tab === "adspend" && <AdspendPanel />}
        {tab === "team" && <TeamPanel />}
      </section>
    </main>
  );
}

function DashboardPanel() {
  return (
    <div>
      <h2 style={styles.h2}>대시보드</h2>
      <p style={styles.muted}>
        채널별·팀별 인입·접수·광고비·인입율을 한눈에 확인합니다. (데이터 연동
        대기)
      </p>
      <div style={styles.grid}>
        <Card label="총 인입" value="—" />
        <Card label="총 접수" value="—" />
        <Card label="총 광고비" value="—" />
        <Card label="평균 인입율" value="—" />
      </div>
    </div>
  );
}

function AdspendPanel() {
  return (
    <div>
      <h2 style={styles.h2}>광고비 설정</h2>
      <p style={styles.muted}>타입 A(API 자동) / B(건당 계산) / C(월 수동)</p>
      <ul style={styles.list}>
        <li>A: 네이버·카카오·구글·Meta API 연동</li>
        <li>B: 배치 시점 단가 × 인입수 저장 (3-3-1)</li>
        <li>C: 월 단위 수동 입력</li>
      </ul>
    </div>
  );
}

function TeamPanel() {
  return (
    <div>
      <h2 style={styles.h2}>팀·상담원 구성</h2>
      <p style={styles.muted}>
        상담원명 앞뒤 공백 자동 trim. 미매핑 상담원은 알림 후 등록 시 자동 반영.
      </p>
      <ul style={styles.list}>
        <li>팀 등록·수정</li>
        <li>상담원 매핑</li>
        <li>매핑 실패 알림 큐</li>
      </ul>
    </div>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.card}>
      <div style={styles.cardLabel}>{label}</div>
      <div style={styles.cardValue}>{value}</div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  main: {
    maxWidth: 1100,
    margin: "0 auto",
    padding: "32px 24px",
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 700,
    color: "#111827",
  },
  subtitle: {
    marginTop: 4,
    fontSize: 13,
    color: "#6b7280",
  },
  tabs: {
    display: "flex",
    gap: 4,
    borderBottom: "1px solid #e5e7eb",
    marginBottom: 20,
  },
  tab: {
    padding: "10px 16px",
    background: "transparent",
    border: 0,
    borderBottom: "2px solid transparent",
    color: "#6b7280",
    fontWeight: 500,
  },
  tabActive: {
    color: "#111827",
    borderBottomColor: "#2563eb",
  },
  panel: {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 8,
    padding: 24,
  },
  h2: {
    fontSize: 18,
    fontWeight: 600,
    marginBottom: 8,
  },
  muted: {
    color: "#6b7280",
    fontSize: 14,
    marginBottom: 16,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 12,
  },
  card: {
    background: "#f9fafb",
    border: "1px solid #e5e7eb",
    borderRadius: 6,
    padding: 16,
  },
  cardLabel: {
    fontSize: 12,
    color: "#6b7280",
    marginBottom: 6,
  },
  cardValue: {
    fontSize: 22,
    fontWeight: 700,
    color: "#111827",
  },
  list: {
    paddingLeft: 18,
    color: "#374151",
    fontSize: 14,
    lineHeight: 1.9,
  },
};
