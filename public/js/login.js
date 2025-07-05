import { auth } from './firebase.js';
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";

window.login = function () {
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  signInWithEmailAndPassword(auth, email, password)
    .then((userCredential) => {
      localStorage.setItem("uid", userCredential.user.uid);
      location.href = "main.html";
    })
    .catch((error) => {
      document.getElementById("error-message").innerText = "登入失敗：" + error.message;
    });
}
