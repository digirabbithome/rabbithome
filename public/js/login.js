import { auth } from './firebase-init.js';
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("loginBtn").addEventListener("click", async () => {
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      localStorage.setItem("uid", user.uid);
      alert("登入成功！");
      window.location.href = "main.html";
    } catch (error) {
      alert("登入失敗：" + error.message);
    }
  });
});
