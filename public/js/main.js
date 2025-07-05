import { auth, db } from './firebase-init.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

onAuthStateChanged(auth, async (user) => {
  if (user) {
    const uid = user.uid;
    const userRef = doc(db, "users", uid);
    const userSnap = await getDoc(userRef);
    let nickname = "未知使用者";
    if (userSnap.exists() && userSnap.data().nickname) {
      nickname = userSnap.data().nickname;
    }
    document.getElementById("welcomeMsg").innerText = `🎉 歡迎回來，${nickname}！`;
  } else {
    window.location.href = "/login.html";
  }
});
