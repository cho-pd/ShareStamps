// 점주 월간 정산 연산 모듈 — 안티그래비티 settlement_architecture.md 설계를 현 Next.js 구조로 번역.
// 비즈니스 로직(연산)과 UI를 분리한다는 원칙 유지. UI(owner/dashboard)는 이 함수 결과만 렌더.
//
// 원본 설계와 다른 점(의도적):
// · 데이터 원천을 stampTransactions/pointTransactions/gifts 3개 대신 stores/{id}/stampLog 하나로 통합.
//   (earn: receipt|review|owner · gift · redeem · expired 이벤트가 count/value 필드와 함께 기록됨)
// · 1스탬프 가치 = 보상÷9 (9개 시스템) + 로그에 기록된 획득시점 잠금값(value) 우선 사용.

export type SettleLogEntry = {
  source: string;              // receipt | review | owner | gift | redeem | expired
  amount: number | null;       // 영수증 결제액 (earn 전용)
  count?: number;              // 스탬프 개수 (신규 로그에 기록)
  value?: number;              // 이벤트 가치 $ (신규 로그에 기록 — 획득시점 잠금)
  createdAt: string;
};

export type SettleDonation = {
  npoName?: string;
  amount?: number;
  settled?: boolean;
  source?: string;             // 'expired' 자동기부 여부
  createdAt: string;
  refPath?: string;            // Firestore 문서 경로 — 정산완료 마킹용
};

export type NpoRow = {
  npoName: string;
  count: number;               // 기부 건수
  total: number;
  pending: number;             // 미정산(송금 대기)
  settled: number;             // 정산 완료
  refPaths: string[];          // 이 NPO의 미정산 문서 경로들
};

export type SettlementReport = {
  periodLabel: string;
  issued: { count: number; value: number };           // ① 발행 스탬프 (earn)
  gifted: { count: number; value: number };           // ② 친구 선물 이동
  redeemed: { count: number; value: number };         // ③ 캐시 전환
  expired: { count: number; value: number };          // 만료 자동 기부
  receiptTotal: number;                               // 영수증 결제 총액
  donations: { total: number; pending: number; settled: number; byNpo: NpoRow[] };  // ④ NPO 기부
  discountUsed: number;                               // ⑤ 캐시 할인 사용 (승인 흐름 연동 예정 → 0)
  outstanding: { count: number; value: number };      // ⑥ 미사용 잔액(부채) — 시점 데이터
};

const EARN_SOURCES = new Set(['receipt', 'review', 'owner']);

/** 기간(월) 필터 + 집계. year/month가 null이면 전체 기간. */
export function buildSettlementReport(params: {
  year: number | null;                 // 예: 2026 (null = 전체)
  month: number | null;                // 1~12 (null = 전체)
  logs: SettleLogEntry[];
  donations: SettleDonation[];
  outstandingCount: number;            // 현재 미사용 스탬프 총합 (시점)
  stampValue: number;                  // 폴백 가치 = reward/9 (로그에 value 없을 때)
}): SettlementReport {
  const { year, month, logs, donations, outstandingCount, stampValue } = params;

  const inPeriod = (iso: string) => {
    if (year == null || month == null) return true;
    const d = new Date(iso);
    return d.getFullYear() === year && d.getMonth() + 1 === month;
  };

  const pLogs = logs.filter((l) => l.createdAt && inPeriod(l.createdAt));
  const sum = (rows: SettleLogEntry[]) => rows.reduce(
    (a, l) => ({ count: a.count + (l.count ?? 1), value: a.value + (l.value ?? (l.count ?? 1) * stampValue) }),
    { count: 0, value: 0 },
  );

  const earnRows = pLogs.filter((l) => EARN_SOURCES.has(l.source));
  const issued = sum(earnRows);
  const gifted = sum(pLogs.filter((l) => l.source === 'gift'));
  const redeemed = sum(pLogs.filter((l) => l.source === 'redeem'));
  const expired = sum(pLogs.filter((l) => l.source === 'expired'));
  const receiptTotal = earnRows.reduce((s, l) => s + (l.amount || 0), 0);

  // NPO 기부 결산 (대기/완료)
  const pDons = donations.filter((d) => d.createdAt && inPeriod(d.createdAt));
  const byNpoMap = new Map<string, NpoRow>();
  for (const d of pDons) {
    const key = d.npoName || '기타';
    const row = byNpoMap.get(key) || { npoName: key, count: 0, total: 0, pending: 0, settled: 0, refPaths: [] };
    const amt = d.amount || 0;
    row.count += 1; row.total += amt;
    if (d.settled) row.settled += amt;
    else { row.pending += amt; if (d.refPath) row.refPaths.push(d.refPath); }
    byNpoMap.set(key, row);
  }
  const byNpo = [...byNpoMap.values()].sort((a, b) => b.total - a.total);
  const donTotal = byNpo.reduce((s, r) => s + r.total, 0);
  const donPending = byNpo.reduce((s, r) => s + r.pending, 0);

  const periodLabel = year == null || month == null ? '전체 기간' : `${year}년 ${month}월`;

  return {
    periodLabel,
    issued, gifted, redeemed, expired, receiptTotal,
    donations: { total: donTotal, pending: donPending, settled: donTotal - donPending, byNpo },
    discountUsed: 0, // 캐시 결제 승인 흐름 연동 시 spend 로그 합산으로 교체
    outstanding: { count: outstandingCount, value: outstandingCount * stampValue },
  };
}

/** 만료 기부처 결정 우선순위: 손님 지정 → 매장 지정 → 폴백(매장 승인 단체 1순위 등) */
export function resolveExpiredNpo(opts: {
  customerNpo?: { id?: string; name?: string } | null;
  storeNpo?: { id?: string; name?: string } | null;
  fallback?: { id?: string; name?: string } | null;
}): { id: string; name: string } | null {
  const pick = (x?: { id?: string; name?: string } | null) => (x && x.name ? { id: x.id || '', name: x.name } : null);
  return pick(opts.customerNpo) || pick(opts.storeNpo) || pick(opts.fallback);
}
