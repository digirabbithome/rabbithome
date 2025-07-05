import { auth } from './firebase-init.js';
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";

document.getElementById("loginButton").addEventListener("click", () => {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  const status = document.getElementById("status");

  signInWithEmailAndPassword(auth, email, password)
    .then((userCredential) => {
      status.textContent = "登入成功，歡迎回來！";
      window.location.href = "dashboard.html";
    })
    .catch((error) => {
      status.textContent = "登入失敗：" + error.message;
    });
});