
import { auth } from './firebase.js';
import {
  onAuthStateChanged,
  signOut,
  createUserWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";

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
    <input type="email" id="new-email" placeholder="Email" /><br/>
    <input type="password" id="new-password" placeholder="密碼" /><br/>
    <input type="text" id="new-name" placeholder="姓名" /><br/>
    <input type="text" id="new-nickname" placeholder="綽號" /><br/>
    <input type="date" id="new-birthday" placeholder="生日" /><br/>
    <label><input type="radio" name="group" value="外場" /> 外場</label>
    <label><input type="radio" name="group" value="內場" /> 內場</label>
    <label><input type="radio" name="group" value="美編" /> 美編</label>
    <label><input type="radio" name="group" value="出貨" /> 出貨</label><br/>
    <button id="submit-newuser">送出</button>
    <p id="user-message" style="color: green;"></p>
  `;

  document.getElementById("submit-newuser").addEventListener("click", async () => {
    const email = document.getElementById("new-email").value;
    const password = document.getElementById("new-password").value;
    const name = document.getElementById("new-name").value;
    const nickname = document.getElementById("new-nickname").value;
    const birthday = document.getElementById("new-birthday").value;
    const group = document.querySelector('input[name="group"]:checked')?.value || "";
    const message = document.getElementById("user-message");

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const uid = userCredential.user.uid;

      // 建立 Firestore 文件
      const firestoreURL = `https://firestore.googleapis.com/v1/projects/rabbithome-auth/databases/(default)/documents/users?documentId=${uid}`;
      await fetch(firestoreURL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fields: {
            email: { stringValue: email },
            name: { stringValue: name },
            nickname: { stringValue: nickname },
            birthday: { stringValue: birthday },
            group: { stringValue: group }
          }
        })
      });

      message.style.color = "green";
      message.textContent = "✅ 帳號新增成功！";
    } catch (error) {
      message.style.color = "red";
      message.textContent = "❌ 錯誤：" + error.message;
    }
  });
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
