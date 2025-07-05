import { auth } from './firebase-init.js';

document.addEventListener("DOMContentLoaded", () => {
  const user = auth.currentUser;
  const nicknameSpan = document.getElementById("nickname");

  if (user) {
    nicknameSpan.textContent = user.displayName || user.email;
  } else {
    nicknameSpan.textContent = "未知使用者";
  }
});
