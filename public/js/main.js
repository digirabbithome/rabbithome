import { auth } from './firebase.js';
import { signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";

const nicknameEl = document.getElementById("nickname");
const workspace = document.getElementById("workspace");

onAuthStateChanged(auth, (user) => {
  if (user) {
    const uid = user.uid;
    fetch(`https://firestore.googleapis.com/v1/projects/rabbithome-auth/databases/(default)/documents/users/${uid}`)
      .then(res => res.json())
      .then(data => {
        const nickname = data.fields?.nickname?.stringValue || "未知使用者";
        nicknameEl.innerText = `Hello，${nickname}！`;
      });
  } else {
    location.href = "login.html";
  }
});

document.getElementById("logout").addEventListener("click", () => {
  signOut(auth).then(() => {
    location.href = "login.html";
  });
});
