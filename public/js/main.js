
document.addEventListener("DOMContentLoaded", () => {
  const nicknameEl = document.getElementById("userNickname");
  const user = JSON.parse(localStorage.getItem("user"));
  if (user?.nickname && nicknameEl) {
    nicknameEl.textContent = user.nickname;
  }

  document.querySelectorAll(".sidebar-button").forEach(btn => {
    btn.addEventListener("click", () => {
      const target = btn.getAttribute("data-target");
      const contentEl = document.getElementById("mainContent");
      if (!contentEl) return;

      switch (target) {
        case "daily":
          contentEl.innerHTML = "<h2>📋 每日工作</h2><p>打卡內容區</p>";
          break;
        case "progress":
          contentEl.innerHTML = "<h2>🗂️ 工作進度</h2><p>進度統計區塊（待建）</p>";
          break;
        case "envelope":
          contentEl.innerHTML = "<h2>✉️ 列印信封</h2><p>信封表單區塊（待建）</p>";
          break;
        case "addUser":
          contentEl.innerHTML = "<h2>👤 新增帳號</h2><p>表單區塊（待建）</p>";
          break;
        case "userList":
          contentEl.innerHTML = "<h2>👥 會員管理</h2><p>成員名單（待建）</p>";
          break;
        default:
          break;
      }
    });
  });

  document.getElementById("logoutBtn")?.addEventListener("click", () => {
    localStorage.removeItem("user");
    window.location.href = "login.html";
  });
});
