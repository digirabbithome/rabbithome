document.addEventListener("DOMContentLoaded", () => {
  const nickname = sessionStorage.getItem("nickname") || "使用者";
  document.getElementById("welcome-text").textContent = `Hello ${nickname}`;

  document.getElementById("logout-btn").addEventListener("click", () => {
    sessionStorage.clear();
    window.location.href = "login.html";
  });
});
