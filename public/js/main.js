import { auth } from "./firebase.js";
import { signOut } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";

document.addEventListener("DOMContentLoaded", () => {
  const nicknameDisplay = document.getElementById("user-nickname");
  const email = sessionStorage.getItem("userEmail") || "";
  nicknameDisplay.textContent = "Hello，" + email + "！";

  const logoutBtn = document.getElementById("nav-logout");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      await signOut(auth);
      sessionStorage.clear();
      window.location.href = "login.html";
    });
  }
});
