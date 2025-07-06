import { auth } from './firebase.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";

onAuthStateChanged(auth, (user) => {
  if (user) {
    const nickname = localStorage.getItem('nickname') || '使用者';
    document.getElementById('sidebar').innerHTML = `<div>🙋‍♂️ Hello，${nickname}！</div>
      <div onclick="alert('每日工作')">📋 每日工作</div>
      <div onclick="alert('工作進度')">🗂️ 工作進度</div>
      <div onclick="alert('列印信封')">✉️ 列印信封</div>
      <div onclick="alert('新增帳號')">👤 新增帳號</div>
      <div onclick="alert('會員管理')">👥 會員管理</div>
      <div onclick="logout()">🚪 登出</div>`;
  } else {
    window.location.href = "login.html";
  }
});

window.logout = function () {
  signOut(auth).then(() => {
    window.location.href = "login.html";
  });
};