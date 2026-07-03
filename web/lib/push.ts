// 웹푸시 구독 클라이언트 헬퍼 — 서비스워커 등록 → 알림 권한 → PushManager 구독 → 구독정보 반환.
// 구독정보는 호출 측에서 Firestore(customers/{deviceId}.pushSub)에 저장한다.
import { getDb } from './firebase';
import { doc, setDoc, deleteField } from 'firebase/firestore';

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export function pushSupported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && !!VAPID_PUBLIC;
}

export function pushPermission(): NotificationPermission | 'unsupported' {
  if (!pushSupported()) return 'unsupported';
  return Notification.permission;
}

// 구독 켜기 — 권한 요청 → 구독 → Firestore 저장. 성공 시 true.
export async function enablePush(deviceId: string): Promise<boolean> {
  if (!pushSupported()) return false;
  try {
    const reg = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') return false;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC) });
    }
    await setDoc(doc(getDb(), 'customers', deviceId), { pushSub: sub.toJSON(), pushOptIn: true, pushUpdatedAt: new Date().toISOString() }, { merge: true });
    return true;
  } catch { return false; }
}

// 구독 끄기 — 브라우저 구독 해지 + Firestore 정리
export async function disablePush(deviceId: string): Promise<void> {
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) await sub.unsubscribe();
  } catch { /* noop */ }
  try { await setDoc(doc(getDb(), 'customers', deviceId), { pushOptIn: false, pushSub: deleteField() }, { merge: true }); } catch { /* noop */ }
}
