// Outstand API 어댑터 (서버 전용). 키는 process.env.OUTSTAND_API_KEY 에서만 읽는다.
// 나중에 다른 업체로 갈아타도 이 파일만 바꾸면 되도록 얇게 유지한다.
const BASE = 'https://api.outstand.so/v1';

export async function outstand(path, { method = 'GET', body } = {}) {
  const key = process.env.OUTSTAND_API_KEY;
  if (!key) return { ok: false, status: 500, data: { error: 'OUTSTAND_API_KEY not set on server' } };
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = {};
  try { data = await res.json(); } catch (e) { /* non-json */ }
  return { ok: res.ok, status: res.status, data };
}

export const json = (statusCode, obj) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(obj),
});

export const parseBody = (event) => {
  try { return JSON.parse(event.body || '{}'); } catch (e) { return {}; }
};

export const VALID_NETWORKS = ['instagram', 'facebook', 'threads', 'x', 'linkedin', 'youtube', 'tiktok', 'pinterest', 'google_business', 'bluesky', 'vimeo'];
