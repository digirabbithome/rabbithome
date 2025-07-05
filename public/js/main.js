import { auth, db } from './firebase-init.js';
import { signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", () => {
  const nicknameSpan = document.getElementById("nickname");
  const logoutBtn = document.getElementById("btn-logout");

  onAuthStateChanged(auth, async (user) => {
    if (user) {
      const uid = user.uid;
      const docRef = doc(db, "users", uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        nicknameSpan.textContent = docSnap.data().nickname;
      } else {
        nicknameSpan.textContent = "未知使用者";
      }
    } else {
      window.location.href = "/login.html";
    }
  });

  logoutBtn.addEventListener("click", async () => {
    await signOut(auth);
    window.location.href = "/login.html";
  });
});
