document.addEventListener("DOMContentLoaded", () => {
  const nickname = localStorage.getItem("nickname") || "未知使用者";
  document.getElementById("nickname").innerText = `Hello, ${nickname}`;
});

function showContent(page) {
  const content = document.getElementById("contentArea");
  switch(page) {
    case 'work':
      content.innerHTML = "<h2>每日工作</h2><p>這裡是每日工作區。</p>";
      break;
    case 'progress':
      content.innerHTML = "<h2>工作進度</h2><p>這裡是工作進度追蹤。</p>";
      break;
    case 'addUser':
      content.innerHTML = `<h2>新增帳號</h2>
        <p>此處放置新增帳號表單。</p>`;
      break;
    case 'manageUsers':
      content.innerHTML = `<h2>會員管理</h2>
        <p>此處顯示所有使用者清單。</p>`;
      break;
    case 'print':
      content.innerHTML = "<h2>列印信封</h2><p>這裡是列印信封工具。</p>";
      break;
  }
}

function logout() {
  localStorage.clear();
  window.location.href = "login.html";
}
