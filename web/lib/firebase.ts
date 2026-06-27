// Firebase 클라이언트 SDK 초기화 (서버 컴포넌트의 공개 데이터 읽기에 사용).
// 공개 웹 config라 노출 무방. 운영 프로젝트: sharestamp-hcho-2606.
// (P5+ 환경변수화 권장. 지금은 호스트 중립 + 즉시 동작 우선.)
import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getFirestore, type Firestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyAbC52KmAifq5GjifF59QF0XqUBgZvziVo',
  authDomain: 'sharestamp-hcho-2606.firebaseapp.com',
  projectId: 'sharestamp-hcho-2606',
  storageBucket: 'sharestamp-hcho-2606.firebasestorage.app',
  messagingSenderId: '353857291164',
  appId: '1:353857291164:web:ab84d846827cbddc55be59',
};

export function getFirebaseApp(): FirebaseApp {
  return getApps().length ? getApp() : initializeApp(firebaseConfig);
}

export function getDb(): Firestore {
  return getFirestore(getFirebaseApp());
}
