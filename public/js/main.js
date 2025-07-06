
import { auth } from './firebase.js';
import { signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';

function loadPage(page) {
  document.querySelector('.main-content').innerHTML = `<h1>🔄 ${page} 頁面載入中...</h1>`;
}

function logout() {
  signOut(auth).then(() => {
    window.location.href = "login.html";
  });
}

onAuthStateChanged(auth, (user) => {
  if (user) {
    const nickname = localStorage.getItem('nickname') || "使用者";
    document.getElementById('nickname').textContent = nickname;
  } else {
    window.location.href = "login.html";
  }
});

window.loadPage = loadPage;
window.logout = logout;
