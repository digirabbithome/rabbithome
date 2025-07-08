
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyANuDJyJuQbxnXq-FTyaTAI9mSc6zpmuWs",
  authDomain: "rabbithome-auth.firebaseapp.com",
  projectId: "rabbithome-auth"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

onAuthStateChanged(auth, user => {
  if (user) {
    const nickname = localStorage.getItem("nickname") || "使用者";
    document.getElementById("nicknameLabel").innerText = `🙋‍♂️ Hello，${nickname}`;
  } else {
    window.location.href = "login.html";
  }
});

function logout() {
  signOut(auth).then(() => {
    window.location.href = "login.html";
  });
}

window.goToPage = function(page) {
  document.getElementById("main-content").src = page;
};
window.logout = logout;
