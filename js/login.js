import { auth } from './firebase-init.js';
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";

document.getElementById('loginBtn').addEventListener('click', async () => {
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    alert('🎉 歡迎來到數位小兔首頁！登入成功 🎉');
    window.location.href = 'index.html';
  } catch (error) {
    alert('登入失敗：' + error.message);
  }
});
