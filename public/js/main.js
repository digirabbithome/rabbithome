// main.js 功能：登入狀態、登出、新增帳號等功能
import { auth } from './firebase.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';

window.addEventListener('DOMContentLoaded', () => {
  const nickname = localStorage.getItem('nickname') || '使用者';
  document.getElementById('nickname').textContent = nickname;

  onAuthStateChanged(auth, (user) => {
    if (!user) {
      window.location.href = 'login.html';
    }
  });
});

function logout() {
  signOut(auth).then(() => {
    window.location.href = 'login.html';
  });
}

function goTo(page) {
  window.location.href = page;
}

window.logout = logout;
window.goTo = goTo;
