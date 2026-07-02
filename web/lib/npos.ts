// 비영리단체(NPO/NGO) 마스터 목록.
// · 본사가 admin '🎗️ 비영리단체' 메뉴에서 Firestore(`npos` 컬렉션)로 직접 관리(목록·등록·상세).
// · 아래 NPOS 는 Firestore 가 비었을 때의 기본 시드/폴백이다.
// · 본사가 매장별 "본사 지정 3개"를 이 목록에서 드롭다운으로 고르고, 고객앱(/me) 기부 폴백도 공유한다.
export type Npo = {
  id: string;
  name: string;
  sub?: string;        // 한줄 설명 (고객 노출)
  linkUrl?: string;    // 단체 홈페이지
  about?: string;      // 상세 설명
  category?: string;   // 분야 (아동·환경·동물 등)
  docUrl?: string;     // 501(c)(3) 증빙 서류 URL
  docName?: string;
};

export const NPOS: Npo[] = [
  { id: 'npo_save', name: '세이브더칠드런', sub: '어린이 급식 지원', linkUrl: 'https://www.savethechildren.org' },
  { id: 'npo_green', name: '그린피스', sub: '기후 위기 대응', linkUrl: 'https://www.greenpeace.org' },
  { id: 'npo_kara', name: 'KARA', sub: '동물권 행동', linkUrl: 'https://www.ekara.org' },
  { id: 'npo_unicef', name: '유니세프', sub: '아동 구호·보건', linkUrl: 'https://www.unicef.org' },
  { id: 'npo_redcross', name: '적십자', sub: '재난 구호', linkUrl: 'https://www.redcross.org' },
  { id: 'npo_habitat', name: '해비타트', sub: '주거 지원', linkUrl: 'https://www.habitat.org' },
  { id: 'npo_wwf', name: 'WWF', sub: '멸종위기종 보호', linkUrl: 'https://www.worldwildlife.org' },
  { id: 'npo_foodbank', name: '푸드뱅크', sub: '결식 이웃 지원', linkUrl: 'https://www.feedingamerica.org' },
];

export const npoById = (id?: string): Npo | undefined => NPOS.find((n) => n.id === id);
