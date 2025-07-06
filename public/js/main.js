import { auth } from './firebase.js';
import { signOut } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';

document.getElementById('logout-btn').addEventListener('click', async () => {
  await signOut(auth);
  window.location.href = "login.html";
});

document.getElementById('daily-task-btn').addEventListener('click', () => {
  document.getElementById('content-area').innerHTML = "<h3>📅 每日工作區</h3><p>這裡是每日工作內容。</p>";
});

document.getElementById('create-account-btn').addEventListener('click', () => {
  document.getElementById('content-area').innerHTML = `
    <h3>➕ 新增帳號</h3>
    <input id="new-email" placeholder="Email"><br>
    <input id="new-password" type="password" placeholder="密碼"><br>
    <input id="nickname" placeholder="暱稱"><br>
    <label>群組：</label><br>
    <label><input type="checkbox" value="外場">外場</label>
    <label><input type="checkbox" value="內場">內場</label>
    <label><input type="checkbox" value="美編">美編</label>
    <label><input type="checkbox" value="出貨">出貨</label>
    <label><input type="checkbox" value="維修">維修</label><br>
    <button id="submit-account">新增</button>
    <p id="add-user-msg"></p>
  `;

  document.getElementById('submit-account').addEventListener('click', async () => {
    document.getElementById('add-user-msg').textContent = "⚙️ 模擬新增帳號中（未串 Firebase 實作）";
  });
});
