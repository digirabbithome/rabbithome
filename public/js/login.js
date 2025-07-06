
import { auth, db } from './firebase.js';
import { signInWithEmailAndPassword } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';

window.login = async function () {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  const errorMessage = document.getElementById("error-message");

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const uid = userCredential.user.uid;
    const userDoc = await getDoc(doc(db, "users", uid));
    const userData = userDoc.data();
    if (userData?.nickname) {
      localStorage.setItem("user", JSON.stringify({ nickname: userData.nickname }));
    }
    window.location.href = "main.html";
  } catch (error) {
    errorMessage.textContent = "登入失敗：" + error.message;
  }
};
