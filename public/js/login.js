
import { auth, db } from './firebase.js';
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

window.login = function () {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  const errorMessage = document.getElementById("error-message");

  signInWithEmailAndPassword(auth, email, password)
    .then(async (userCredential) => {
      const user = userCredential.user;
      const uid = user.uid;

      const docRef = doc(db, "users", uid);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        localStorage.setItem("user", JSON.stringify({
          email: user.email,
          nickname: data.nickname || "使用者"
        }));
      } else {
        localStorage.setItem("user", JSON.stringify({
          email: user.email,
          nickname: "使用者"
        }));
      }

      window.location.href = "main.html";
    })
    .catch((error) => {
      errorMessage.textContent = "登入失敗：" + error.message;
    });
};
