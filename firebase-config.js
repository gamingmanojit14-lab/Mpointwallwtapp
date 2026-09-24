/**
 * Firebase Web SDK config.
 * Firebase Console → Project Settings → General → Your apps → Web app → Config
 *
 * ⚠️ এই values public-safe (client-side) — Firestore Rules দিয়ে protect করতে হবে।
 */
window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  authDomain: "p2p-wallet-XXXXX.firebaseapp.com",
  projectId: "p2p-wallet-XXXXX",
  storageBucket: "p2p-wallet-XXXXX.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef1234567890abcdef",
};

// Render backend base URL
window.API_BASE_URL = "https://p2p-wallet-api.onrender.com";
