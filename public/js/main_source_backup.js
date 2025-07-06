
import { auth } from './firebase.js';
import {
  onAuthStateChanged,
  signOut,
  createUserWithEmailAndPassword,
  updatePassword
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";

const nicknameSpan = document.getElementById("nickname");
const contentDiv = document.getElementById("content");

onAuthStateChanged(auth, (user) => {
  if (user) {
    fetch(`https://firestore.googleapis.com/v1/projects/rabbithome-auth/databases/(default)/documents/users/${user.uid}`)
      .then(response => response.json())
      .then(data => {
        const nickname = data.fields?.nickname?.stringValue || "使用者";
        if (nicknameSpan) nicknameSpan.textContent = nickname;
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
    <input type="date" id="new-birthday" /><br/>
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

      await fetch(`https://firestore.googleapis.com/v1/projects/rabbithome-auth/databases/(default)/documents/users?documentId=${uid}`, {
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
  contentDiv.innerHTML = "<h2>👥 會員管理</h2><p>載入中...</p>";

  fetch("https://firestore.googleapis.com/v1/projects/rabbithome-auth/databases/(default)/documents/users")
    .then(response => response.json())
    .then(data => {
      if (!data.documents) {
        contentDiv.innerHTML = "<h2>👥 會員管理</h2><p>目前沒有會員資料</p>";
        return;
      }

      let grouped = {};
      for (const doc of data.documents) {
        const f = doc.fields;
        const group = f.group?.stringValue || "未分組";
        if (!grouped[group]) grouped[group] = [];
        grouped[group].push(f);
      }

      let html = `<h2>👥 會員管理</h2>`;
      for (const group of Object.keys(grouped).sort()) {
        html += `<h3>📌 群組：${group}</h3>`;
        html += `
          <table border="1" cellpadding="6" cellspacing="0">
            <tr>
              <th>姓名</th>
              <th>綽號</th>
              <th>Email</th>
              <th>生日</th>
            </tr>
        `;
        for (const f of grouped[group]) {
          html += `
            <tr>
              <td>${f.name?.stringValue || ""}</td>
              <td>${f.nickname?.stringValue || ""}</td>
              <td>${f.email?.stringValue || ""}</td>
              <td>${f.birthday?.stringValue || ""}</td>
            </tr>
          `;
        }
        html += "</table><br/>";
      }

      html += `
        <hr/>
        <h3>🛠️ 修改自己的密碼</h3>
        <input type="password" id="new-pass1" placeholder="新密碼" /><br/>
        <input type="password" id="new-pass2" placeholder="再次確認" /><br/>
        <button id="change-password">送出修改</button>
        <p id="pw-msg" style="color: green;"></p>
      `;
      contentDiv.innerHTML = html;
    })
    .catch(err => {
      contentDiv.innerHTML = "<h2>👥 會員管理</h2><p style='color:red;'>讀取失敗：" + err.message + "</p>";
    });
});

document.addEventListener("click", (e) => {
  if (e.target.id === "change-password") {
    const p1 = document.getElementById("new-pass1").value;
    const p2 = document.getElementById("new-pass2").value;
    const msg = document.getElementById("pw-msg");

    if (p1 !== p2) {
      msg.style.color = "red";
      msg.textContent = "❌ 兩次密碼輸入不一致";
      return;
    }
    if (p1.length < 6) {
      msg.style.color = "red";
      msg.textContent = "❌ 密碼太短，至少6碼";
      return;
    }

    updatePassword(auth.currentUser, p1).then(() => {
      msg.style.color = "green";
      msg.textContent = "✅ 密碼修改成功！";
    }).catch((err) => {
      msg.style.color = "red";
      msg.textContent = "❌ 錯誤：" + err.message;
    });
  }
});
