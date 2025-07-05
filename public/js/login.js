import { auth } from './firebase-init.js';
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";

document.getElementById('login').addEventListener('click', async () => {
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    localStorage.setItem('uid', userCredential.user.uid);
    window.location.href = 'main.html';
  } catch (error) {
    document.getElementById('message').innerText = "登入失敗：" + error.message;
  }
});
