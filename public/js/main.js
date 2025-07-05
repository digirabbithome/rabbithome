import { auth, db } from './firebase-init.js';
import { signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';

const nicknameSpan = document.getElementById('nickname');
const contentDiv = document.getElementById('content');

onAuthStateChanged(auth, async (user) => {
  if (user) {
    const docRef = doc(db, "users", user.uid);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      nicknameSpan.textContent = docSnap.data().nickname;
    } else {
      nicknameSpan.textContent = "未知使用者";
    }
  } else {
    window.location.href = "login.html";
  }
});

document.getElementById('btn-logout').addEventListener('click', async () => {
  await signOut(auth);
  window.location.href = "login.html";
});

document.getElementById('btn-work').addEventListener('click', () => {
  contentDiv.innerHTML = "<h3>📋 每日工作</h3><p>這裡是每日工作內容。</p>";
});
document.getElementById('btn-progress').addEventListener('click', () => {
  contentDiv.innerHTML = "<h3>📈 工作進度</h3><p>這裡是工作進度頁面。</p>";
});
document.getElementById('btn-add-user').addEventListener('click', () => {
  contentDiv.innerHTML = "<h3>➕ 新增帳號</h3><p>這裡將新增帳號表單。</p>";
});
document.getElementById('btn-member').addEventListener('click', () => {
  contentDiv.innerHTML = "<h3>👥 會員管理</h3><p>這裡是會員管理頁面。</p>";
});
document.getElementById('btn-print').addEventListener('click', () => {
  contentDiv.innerHTML = "<h3>✉️ 列印信封</h3><p>這裡是列印功能。</p>";
});
