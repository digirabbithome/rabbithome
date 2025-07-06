
import { auth } from './firebase.js';
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

const db = getFirestore();

window.login = function () {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  const errorMessage = document.getElementById("error-message");

  signInWithEmailAndPassword(auth, email, password)
    .then(async (userCredential) => {
      const user = userCredential.user;
      const userDoc = await getDoc(doc(db, "users", user.uid));
      const userData = userDoc.exists() ? userDoc.data() : {};
      localStorage.setItem("user", JSON.stringify({
        uid: user.uid,
        email: user.email,
        nickname: userData.nickname || "使用者"
      }));
      window.location.href = "main.html";
    })
    .catch((error) => {
      errorMessage.textContent = "登入失敗：" + error.message;
    });
};
