// 데모 매장을 새 per-store 모델(stores/{id} + menuItems + reviews)로 시드.
// 사용: node web/scripts/seed.mjs   (운영 Firestore의 `stores` 컬렉션에 추가 — 라이브 단일문서 앱과 분리됨)
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, collection } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyAbC52KmAifq5GjifF59QF0XqUBgZvziVo',
  authDomain: 'sharestamp-hcho-2606.firebaseapp.com',
  projectId: 'sharestamp-hcho-2606',
  storageBucket: 'sharestamp-hcho-2606.firebasestorage.app',
  messagingSenderId: '353857291164',
  appId: '1:353857291164:web:ab84d846827cbddc55be59',
};

const db = getFirestore(initializeApp(firebaseConfig));

const store = {
  id: 'store_loveletter',
  slug: 'loveletter-fullerton',
  name: 'LOVELETTER',
  category: 'Korean Restaurant',
  currency: 'USD',
  description:
    'A cozy Korean restaurant in Fullerton serving honey bread, soondubu (soft tofu stew), and bibimbap. Friendly service, fresh daily ingredients, and a warm atmosphere for families and first-timers.',
  hours: '11:00 AM - 10:00 PM',
  phone: '+1-714-555-0142',
  address: { street: '123 Commonwealth Ave', city: 'Fullerton', region: 'CA', postalCode: '92832', country: 'US' },
  priceRange: '$$',
  sellingPoints: ['Korean comfort food', 'fresh daily', 'soondubu', 'honey bread', 'family friendly'],
  pointRewardPer7Stamps: 5,
};
const menu = [
  { id: 'm_honeybread', name: 'Honey Bread', price: 8.99, description: 'Sweet, warm signature dessert', signature: true },
  { id: 'm_soondubu', name: 'Soondubu (Soft Tofu Stew)', price: 13.99, description: 'Spicy soft tofu stew, choose your spice level', signature: true },
  { id: 'm_bibimbap', name: 'Bibimbap', price: 14.99, description: 'Rice bowl with seasoned vegetables and egg' },
  { id: 'm_bulgogi', name: 'Bulgogi', price: 17.99, description: 'Marinated grilled beef' },
];
const reviews = [
  { id: 'r1', author: 'Jamie', rating: 5, comment: 'The soondubu was rich and not too salty. Cozy spot, kind staff.', createdAt: '2026-06-20T19:05:00Z' },
  { id: 'r2', author: 'Min', rating: 4, comment: 'Honey bread is a must — sweet and warm. Will visit again.', createdAt: '2026-06-22T18:40:00Z' },
  { id: 'r3', author: 'Alex', rating: 5, comment: 'First time trying Korean food and the staff explained the menu. Loved the bibimbap.', createdAt: '2026-06-24T20:10:00Z' },
];

const run = async () => {
  await setDoc(doc(db, 'stores', store.id), store);
  for (const m of menu) await setDoc(doc(collection(db, 'stores', store.id, 'menuItems'), m.id), m);
  for (const r of reviews) await setDoc(doc(collection(db, 'stores', store.id, 'reviews'), r.id), r);
  console.log(`Seeded store ${store.id} (${menu.length} menu, ${reviews.length} reviews)`);
  process.exit(0);
};
run().catch((e) => { console.error(e); process.exit(1); });
