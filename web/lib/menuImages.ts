// 메뉴명·카테고리 → 기본 스톡 사진(Unsplash, 상업사용 무료·핫링크 OK). 사장님이 실사진 올리기 전 기본값.
// 규칙: 메뉴가 올라가면 항상 종류에 맞는 사진을 자동으로 찾아 넣는다. (헌터 검증 이미지 IDs)
const U = (id: string) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=800&h=800&q=70`;

const IMG = {
  friedChicken: '1562967914-608f82629710',
  yangnyeom: '1615435312366-2e4ae52255e9',
  popcorn: '1619881590738-a111d176d906',
  pizzaCheese: '1513104890138-7c749659a591',
  pizzaTopping: '1594007654729-407eedc4be65',
  pizzaSupreme: '1599588967784-e5449357dda3',
  pizzaBbq: '1565299624946-b28f40a0ae38',
  fries: '1573080496219-bb080dd4f877',
  loadedFries: '1639744210631-209fce3e256c',
  mozz: '1531749668029-2db88e4276c7',
  onionRings: '1630825533949-74f62f54553a',
  sweetPotatoFries: '1598679253544-2c97992403ea',
  corn: '1630748663209-c4a490505198',
  tots: '1703077710733-72c46d2fcff3',
  pasta: '1664214649076-7b17006db5b5',
  soju: '1528615141309-53f2564d3be8',
  beer: '1571613316887-6f8d5cbf7ef7',
  salad: '1612488261779-be3483951c46',
};

// 매칭되는 좋은 사진이 있으면 URL, 없으면 '' (억지로 틀린 사진 안 넣음 — 소다/주스 등).
export function menuSampleImage(name?: string, category?: string): string {
  const n = (name || '').toLowerCase();
  const has = (...k: string[]) => k.some((x) => n.includes(x));

  if (has('popcorn', '팝콘', '파닭')) return U(IMG.popcorn);
  if (has('wing', '윙')) return U(IMG.friedChicken);
  if (has('pizza', '피자')) {
    if (has('supreme', 'carnivore', '카니보어')) return U(IMG.pizzaSupreme);
    if (has('bbq', 'bulgogi', 'kalbi', '불고기', '갈비')) return U(IMG.pizzaBbq);
    if (has('garden', 'cheese', 'margher', 'veg')) return U(IMG.pizzaCheese);
    return U(IMG.pizzaTopping);
  }
  if ((has('chicken', '치킨') || has('fried', '후라이드', '크리스피', 'crispy')) && !has('fries', 'fr ')) return has('spicy', '양념', 'bbq', 'grilled') ? U(IMG.yangnyeom) : U(IMG.friedChicken);
  if (has('mozz', '치즈스틱', 'cheese stick')) return U(IMG.mozz);
  if (has('onion ring', '어니언')) return U(IMG.onionRings);
  if (has('sweet potato', '고구마')) return U(IMG.sweetPotatoFries);
  if (has('tots', '타터')) return U(IMG.tots);
  if (has('cheese fr', 'loaded', 'bulgogi cheese', '치즈 프라이', '치즈프라이')) return U(IMG.loadedFries);
  if (has('fries', 'fry', '감자', '프라이')) return U(IMG.fries);
  if (has('corn', '콘', '옥수수')) return U(IMG.corn);
  if (has('pasta', '파스타', 'spaghetti', 'noodle')) return U(IMG.pasta);
  if (has('salad', '샐러드')) return U(IMG.salad);
  if (has('soju', '소주', 'jinro', 'chamisul', 'saero', 'hallasan')) return U(IMG.soju);
  if (has('beer', 'lager', 'ale', 'ipa', 'draft', '맥주', 'kloud', 'cloud', 'terra', 'sapporo', 'heineken', 'modelo', 'coors')) return U(IMG.beer);

  // 카테고리 폴백 (음식류만 — 음료(소다/주스)는 억지 이미지 안 넣음)
  const c = (category || '').toUpperCase();
  if (c.includes('PIZZA')) return U(IMG.pizzaCheese);
  if (c.includes('CHICKEN')) return U(IMG.friedChicken);
  if (c.includes('PASTA')) return U(IMG.pasta);
  if (c.includes('SIDE')) return U(IMG.friedChicken);
  if (c.includes('STARTER')) return U(IMG.fries);
  return ''; // DRINKS(소다/주스)·미분류 등: 플레이스홀더 유지(틀린 사진보다 나음)
}
