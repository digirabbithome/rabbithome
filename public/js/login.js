// login.js 功能：登入驗證
import { auth } from './firebase.js';
import { signInWithEmailAndPassword } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';

window.login = function () {
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;

  signInWithEmailAndPassword(auth, email, password)
    .then((userCredential) => {
      const user = userCredential.user;
      localStorage.setItem('nickname', email.split('@')[0]);
      window.location.href = 'main.html';
    })
    .catch((error) => {
      alert('登入失敗：' + error.message);
    });
};
