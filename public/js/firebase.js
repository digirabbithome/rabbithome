
// 請使用你自己的 Firebase 設定值替換以下內容
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "你的-api-key",
  authDomain: "你的-auth-domain",
  projectId: "你的-project-id",
  storageBucket: "你的-storage-bucket",
  messagingSenderId: "你的-messaging-sender-id",
  appId: "你的-app-id"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db };
