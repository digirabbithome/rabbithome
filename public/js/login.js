import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { app } from './firebase.js';

document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  const auth = getAuth(app);

  try {
    await signInWithEmailAndPassword(auth, email, password);
    window.location.href = "dashboard.html";  // 登入成功後導向主頁
  } catch (error) {
    document.getElementById("loginResult").innerText = "❌ 登入失敗：" + error.message;
  }
});
