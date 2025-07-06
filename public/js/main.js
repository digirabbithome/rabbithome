
document.addEventListener("DOMContentLoaded", function () {
  const sidebar = document.getElementById("sidebar");

  const buttons = [
    { icon: "🙋‍♂️", text: "Hello，花花" },
    { icon: "📋", text: "每日工作" },
    { icon: "➕", text: "新增帳號" },
    { icon: "👥", text: "會員管理" },
    { icon: "🔍", text: "資料查詢" },
    { icon: "📊", text: "工作統計" },
    { icon: "🚪", text: "登出" },
  ];

  buttons.forEach(btn => {
    const el = document.createElement("div");
    el.className = "sidebar-button";
    el.textContent = `${btn.icon} ${btn.text}`;
    sidebar.appendChild(el);
  });
});
