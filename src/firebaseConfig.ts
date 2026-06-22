// Firebase web app configuration.
export const firebaseConfig = {
  apiKey: "AIzaSyAbC52KmAifq5GjifF59QF0XqUBgZvziVo",
  authDomain: "sharestamp-hcho-2606.firebaseapp.com",
  projectId: "sharestamp-hcho-2606",
  storageBucket: "sharestamp-hcho-2606.firebasestorage.app",
  messagingSenderId: "353857291164",
  appId: "1:353857291164:web:ab84d846827cbddc55be59"
};

// Returns true if the credentials have been configured by the user
export const isFirebaseConfigured = () => {
  return firebaseConfig.apiKey && firebaseConfig.apiKey !== "YOUR_API_KEY";
};
