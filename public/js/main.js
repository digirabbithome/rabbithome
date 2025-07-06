
import { auth } from './firebase.js';
import { signOut } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';

document.addEventListener("DOMContentLoaded", () => {
  const user = JSON.parse(localStorage.getItem("user"));
  const nicknameElement = document.getElementById("nickname");
  if (user && user.email) {
    nicknameElement.textContent = "Hello，" + user.email + "！";
  }

  document.getElementById("logoutBtn").addEventListener("click", async () => {
    await signOut(auth);
    localStorage.removeItem("user");
    window.location.href = "login.html";
  });
});
