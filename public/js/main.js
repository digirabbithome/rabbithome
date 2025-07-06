
import { auth } from './firebase.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";

const nicknameSpan = document.getElementById("nickname");
const contentDiv = document.getElementById("content");

onAuthStateChanged(auth, (user) => {
  if (user) {
    fetch(`https://firestore.googleapis.com/v1/projects/rabbithome-auth/databases/(default)/documents/users/${user.uid}`)
      .then(response => response.json())
      .then(data => {
        const nickname = data.fields?.nickname?.stringValue || "使用者";
        nicknameSpan.textContent = nickname;
      });
  } else {
    window.location.href = "login.html";
  }
});

document.getElementById("logout-btn").addEventListener("click", () => {
  signOut(auth).then(() => {
    window.location.href = "login.html";
  });
});

document.getElementById("btn-daily").addEventListener("click", () => {
  contentDiv.innerHTML = "<h2>這裡是每日工作區域</h2>";
});

document.getElementById("btn-adduser").addEventListener("click", () => {
  contentDiv.innerHTML = `
    <h2>新增帳號</h2>
    <input type="text" placeholder="Email" /><br/>
    <input type="password" placeholder="密碼" /><br/>
    <input type="text" placeholder="姓名" /><br/>
    <input type="text" placeholder="綽號" /><br/>
    <input type="date" placeholder="生日" /><br/>
    <label><input type="checkbox" value="外場" /> 外場</label>
    <label><input type="checkbox" value="內場" /> 內場</label>
    <label><input type="checkbox" value="美編" /> 美編</label>
    <label><input type="checkbox" value="出貨" /> 出貨</label><br/>
    <button>送出</button>
  `;
});

document.getElementById("btn-progress").addEventListener("click", () => {
  contentDiv.innerHTML = "<h2>🗂️ 工作進度區</h2><p>此區功能尚未建置</p>";
});

document.getElementById("btn-envelope").addEventListener("click", () => {
  contentDiv.innerHTML = "<h2>✉️ 列印信封</h2><p>此區功能尚未建置</p>";
});

document.getElementById("btn-userlist").addEventListener("click", () => {
  contentDiv.innerHTML = "<h2>👥 會員管理</h2><p>此區功能尚未建置</p>";
});
