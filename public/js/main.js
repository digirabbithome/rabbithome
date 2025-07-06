import { auth, db } from './firebase.js';
import { signOut } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import { doc, setDoc } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';

document.addEventListener("DOMContentLoaded", () => {
  const user = JSON.parse(localStorage.getItem("user"));
  if (user?.nickname) {
    document.getElementById("nickname").textContent = user.nickname;
  }

  window.showSection = function (sectionId) {
    document.querySelectorAll(".content-section").forEach(sec => sec.classList.add("hidden"));
    const target = document.getElementById(sectionId);
    if (target) target.classList.remove("hidden");
  };

  window.logout = function () {
    signOut(auth).then(() => {
      localStorage.removeItem("user");
      window.location.href = "login.html";
    });
  };

  const addForm = document.getElementById("addAccountForm");
  if (addForm) {
    addForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = document.getElementById("newEmail").value;
      const nickname = document.getElementById("newNickname").value;
      const name = document.getElementById("newName").value;
      const birthday = document.getElementById("newBirthday").value;
      const password = document.getElementById("newPassword").value;
      const group = document.getElementById("newGroup").value;

      try {
        const uid = Date.now().toString();
        await setDoc(doc(db, "users", uid), {
          email, nickname, name, birthday, password, group
        });
        document.getElementById("addAccountMessage").textContent = "✅ 帳號新增成功！";
        addForm.reset();
      } catch (err) {
        document.getElementById("addAccountMessage").textContent = "❌ 錯誤：" + err.message;
      }
    });
  }
});