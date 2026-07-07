// Outstand API 어댑터 (서버 전용). 키는 process.env.OUTSTAND_API_KEY 에서만 읽는다.
// 업체를 갈아타도 이 파일만 바꾸면 되도록 얇게 유지. (Netlify _outstand.mjs 의 Next 버전)
// sns-post / sns-connect-url / sns-status 라우트가 공유한다.
const BASE = 'https://api.outstand.so/v1';

export const VALID_NETWORKS = [
  'instagram', 'facebook', 'threads', 'x', 'linkedin',
  'youtube', 'tiktok', 'pinterest', 'google_business', 'bluesky', 'vimeo',
];

export type OutstandResult = { ok: boolean; status: number; data: Record<string, unknown> };

export async function outstand(
  path: string,
  opts: { method?: string; body?: unknown } = {},
): Promise<OutstandResult> {
  const key = process.env.OUTSTAND_API_KEY;
  if (!key) return { ok: false, status: 500, data: { error: 'OUTSTAND_API_KEY not set on server' } };
  const res = await fetch(`${BASE}${path}`, {
    method: opts.method || 'GET',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  let data: Record<string, unknown> = {};
  try { data = await res.json(); } catch { /* non-json */ }
  return { ok: res.ok, status: res.status, data };
}
