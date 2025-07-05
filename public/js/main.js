document.getElementById("logout").addEventListener("click", () => {
  alert("已登出（尚未串接登出邏輯）");
});
document.getElementById("btn-daily").addEventListener("click", () => {
  document.getElementById("content").innerHTML = "<h3>📋 每日工作</h3><p>這裡是每日工作內容...</p>";
});
document.getElementById("btn-create").addEventListener("click", () => {
  document.getElementById("content").innerHTML = "<h3>👤 新增帳號</h3><p>新增帳號功能尚待實作...</p>";
});