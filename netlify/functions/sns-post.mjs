// 매장(tenant_id)의 연결된 채널에 게시. 고객 AI 리뷰가 등록될 때 호출.
// 검증된 형식: POST /v1/posts/  { accounts:[id...], containers:[{ content, media:[{filename,url,content_type}] }] }
// media 는 외부 공개 URL 직접 사용 가능(업로드 불필요). 인스타는 이미지 필수.
import { outstand, json, parseBody } from './_outstand.mjs';

const guessContentType = (url) => {
  const ext = (url.split('?')[0].split('.').pop() || '').toLowerCase();
  if (ext === 'png') return 'image/png';
  if (ext === 'gif') return 'image/gif';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'mp4' || ext === 'm4v') return 'video/mp4';
  if (ext === 'mov') return 'video/quicktime';
  return 'image/jpeg';
};

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'POST only' });
  const { storeId, content, mediaUrls, networks } = parseBody(event);
  if (!storeId || !content) return json(400, { error: 'storeId, content 필요' });

  // 이 매장에 연결된 계정 조회
  const acc = await outstand(`/social-accounts?tenant_id=${encodeURIComponent(storeId)}`);
  if (!acc.ok) return json(acc.status || 502, { error: '계정 조회 실패', details: acc.data });
  let list = Array.isArray(acc.data?.data) ? acc.data.data : [];

  // 점주가 켠 네트워크만 추리기 (networks 전달 시)
  if (Array.isArray(networks) && networks.length) {
    list = list.filter((a) => networks.includes(a.network));
  }
  const accountIds = list.map((a) => a.id).filter(Boolean);
  if (!accountIds.length) return json(400, { error: '이 매장에 연결된(또는 켜진) SNS 계정이 없습니다.' });

  // 미디어: 외부 공개 URL을 인라인 객체로 (인스타는 이미지 필수)
  const media = (Array.isArray(mediaUrls) ? mediaUrls : [])
    .filter(Boolean)
    .map((url) => ({
      filename: (url.split('?')[0].split('/').pop() || 'image.jpg'),
      url,
      content_type: guessContentType(url),
    }));

  const container = { content };
  if (media.length) container.media = media;

  const r = await outstand('/posts/', {
    method: 'POST',
    body: { accounts: accountIds, containers: [container] },
  });
  if (!r.ok || r.data?.success === false) {
    return json(r.status || 502, { error: '게시 실패', details: r.data });
  }
  return json(200, { success: true, postId: r.data?.post?.id, postedTo: accountIds.length });
};
