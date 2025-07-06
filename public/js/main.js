
import { auth } from './firebase.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getFirestore, collection, addDoc, getDoc, doc } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const db = getFirestore();

document.addEventListener("DOMContentLoaded", () => {
  const nicknameSpan = document.getElementById("nickname");
  const logoutBtn = document.getElementById("logoutBtn");
  const addAccountBtn = document.getElementById("addAccountBtn");
  const contentArea = document.getElementById("content");

  onAuthStateChanged(auth, async (user) => {
    if (user) {
      const userDoc = await getDoc(doc(db, "users", user.uid));
      const data = userDoc.data();
      nicknameSpan.textContent = data.nickname || "未命名";
    } else {
      window.location.href = "login.html";
    }
  });

  logoutBtn.addEventListener("click", () => {
    signOut(auth).then(() => {
      window.location.href = "login.html";
    });
  });

  addAccountBtn.addEventListener("click", () => {
    contentArea.innerHTML = `
      <h2>新增帳號</h2>
      <input id="newEmail" placeholder="Email"><br>
      <input id="newPassword" placeholder="Password" type="password"><br>
      <input id="newNickname" placeholder="暱稱"><br>
      <label><input type="checkbox" value="內場">內場</label>
      <label><input type="checkbox" value="外場">外場</label>
      <label><input type="checkbox" value="美編">美編</label>
      <label><input type="checkbox" value="出貨">出貨</label>
      <label><input type="checkbox" value="維修">維修</label><br>
      <button id="submitAccount">送出</button>
    `;

    document.getElementById("submitAccount").addEventListener("click", async () => {
      const email = document.getElementById("newEmail").value;
      const password = document.getElementById("newPassword").value;
      const nickname = document.getElementById("newNickname").value;
      const groups = Array.from(document.querySelectorAll('input[type="checkbox"]:checked')).map(el => el.value);

      const userCredential = await auth.createUserWithEmailAndPassword(email, password);
      const uid = userCredential.user.uid;

      await addDoc(collection(db, "users"), {
        uid,
        email,
        nickname,
        groups
      });

      alert("新增帳號成功！");
    });
  });
});
