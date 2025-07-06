import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAKl-xxxxxxx",  // ✅ 保護設定
  authDomain: "rabbithome.firebaseapp.com",
  projectId: "rabbithome",
  storageBucket: "rabbithome.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:xxxxxxxx"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
