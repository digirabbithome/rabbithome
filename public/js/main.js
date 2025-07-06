document.addEventListener("DOMContentLoaded", function () {
  const nicknameEl = document.getElementById("nickname");
  if (nicknameEl) {
    const userData = JSON.parse(localStorage.getItem("user"));
    if (userData && userData.nickname) {
      nicknameEl.textContent = `Hello，${userData.nickname}！`;
    } else {
      nicknameEl.textContent = "Hello！";
    }
  }
});
