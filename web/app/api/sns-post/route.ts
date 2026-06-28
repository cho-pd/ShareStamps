// SNS 자동게시 (Next API Route, 호스트 중립). Outstand 키는 서버 env OUTSTAND_API_KEY 에서만.
// Netlify Function(sns-post.mjs + _outstand.mjs)을 대체.
const BASE = 'https://api.outstand.so/v1';

async function outstand(path: string, opts: { method?: string; body?: unknown } = {}) {
  const key = process.env.OUTSTAND_API_KEY;
  if (!key) return { ok: false, status: 500, data: { error: 'OUTSTAND_API_KEY not set' } as Record<string, unknown> };
  const res = await fetch(`${BASE}${path}`, {
    method: opts.method || 'GET',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  let data: Record<string, unknown> = {};
  try { data = await res.json(); } catch {}
  return { ok: res.ok, status: res.status, data };
}

function guessContentType(url: string): string {
  const ext = (url.split('?')[0].split('.').pop() || '').toLowerCase();
  if (ext === 'png') return 'image/png';
  if (ext === 'gif') return 'image/gif';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'mp4' || ext === 'm4v') return 'video/mp4';
  if (ext === 'mov') return 'video/quicktime';
  return 'image/jpeg';
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { storeId, content, mediaUrls, networks } = body as {
    storeId?: string; content?: string; mediaUrls?: string[]; networks?: string[];
  };
  if (!storeId || !content) return Response.json({ error: 'storeId, content required' }, { status: 400 });

  const acc = await outstand(`/social-accounts?tenant_id=${encodeURIComponent(storeId)}`);
  if (!acc.ok) return Response.json({ error: 'account lookup failed', details: acc.data }, { status: acc.status || 502 });
  let list = Array.isArray((acc.data as { data?: unknown }).data) ? (acc.data as { data: { id?: string; network?: string }[] }).data : [];
  if (Array.isArray(networks) && networks.length) list = list.filter((a) => a.network && networks.includes(a.network));

  const accountIds = list.map((a) => a.id).filter(Boolean);
  const postedNetworks = [...new Set(list.map((a) => a.network).filter(Boolean))];
  if (!accountIds.length) return Response.json({ error: 'no connected SNS accounts for store' }, { status: 400 });

  const media = (Array.isArray(mediaUrls) ? mediaUrls : []).filter(Boolean).map((url) => ({
    filename: url.split('?')[0].split('/').pop() || 'image.jpg',
    url,
    content_type: guessContentType(url),
  }));
  const container: Record<string, unknown> = { content };
  if (media.length) container.media = media;

  const r = await outstand('/posts/', { method: 'POST', body: { accounts: accountIds, containers: [container] } });
  if (!r.ok || (r.data as { success?: boolean }).success === false) {
    return Response.json({ error: 'post failed', details: r.data }, { status: r.status || 502 });
  }
  return Response.json({ success: true, postId: (r.data as { post?: { id?: string } }).post?.id, postedNetworks });
}
