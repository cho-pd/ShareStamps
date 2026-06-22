import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, terminate } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAbC52KmAifq5GjifF59QF0XqUBgZvziVo",
  authDomain: "sharestamp-hcho-2606.firebaseapp.com",
  projectId: "sharestamp-hcho-2606",
  storageBucket: "sharestamp-hcho-2606.firebasestorage.app",
  messagingSenderId: "353857291164",
  appId: "1:353857291164:web:ab84d846827cbddc55be59"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  try {
    const docRef = doc(db, 'sharestamps', 'database');
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      const state = data.state;
      console.log("=== DB DUMP SUCCESS ===");
      console.log("Total Users:", state.users?.length);
      console.log("Total Stamp Cards:", state.stampCards?.length);
      
      // 조pd 찾기
      const jopd = state.users.find(u => u.name.includes("조pd") || u.nickname?.includes("조pd"));
      if (jopd) {
        console.log("\n[User Jopd Found]");
        console.log(jopd);
        
        // 조pd의 스탬프 카드
        const jopdCards = state.stampCards.filter(c => c.userId === jopd.id);
        console.log("\n[Jopd Stamp Cards]");
        console.log(jopdCards);
        
        // 조pd의 스탬프 트랜잭션
        const jopdStampTxs = state.stampTransactions?.filter(tx => tx.userId === jopd.id);
        console.log("\n[Jopd Stamp Transactions]");
        console.log(jopdStampTxs);
      } else {
        console.log("\nUser '조pd' not found in users list.");
        console.log("Available user list (first 10):", state.users.slice(0, 10).map(u => ({ id: u.id, name: u.name, nickname: u.nickname })));
      }
    } else {
      console.log("No sharestamps/database document exists in Firestore!");
    }
  } catch (err) {
    console.error("Error reading Firestore:", err);
  } finally {
    try {
      await terminate(db);
      console.log("=== DB CONNECTION TERMINATED ===");
    } catch (e) {
      console.error("Error terminating Firestore connection:", e);
    }
  }
}

run();
