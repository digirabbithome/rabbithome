
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
    const nicknameLabel = document.getElementById("nickname-display");
    if (nicknameLabel) nicknameLabel.innerText = `🙋‍♂️ Hello，${nickname}`;
  } else {
    window.location.href = "login.html";
  }
});

window.navigate = function(page) {
  document.getElementById("content-frame").src = page;
};

window.logout = function() {
  signOut(auth).then(() => {
    window.location.href = "login.html";
  });
};
