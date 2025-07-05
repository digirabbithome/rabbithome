const nickname = localStorage.getItem("nickname") || "使用者";
document.getElementById("nicknameArea").innerText = "👋 Hello, " + nickname + "!";

const mainContent = document.getElementById("mainContent");

window.showPage = function(page) {
  switch(page) {
    case "daily":
      mainContent.innerHTML = "📝 每日工作畫面（待建置）";
      break;
    case "progress":
      mainContent.innerHTML = "📊 工作進度畫面（待建置）";
      break;
    case "adduser":
      mainContent.innerHTML = "🧾 新增帳號畫面（待建置）";
      break;
    case "members":
      mainContent.innerHTML = "👤 會員管理畫面（待建置）";
      break;
    case "print":
      mainContent.innerHTML = "✉️ 列印信封畫面（待建置）";
      break;
  }
};

window.logout = function() {
  localStorage.removeItem("nickname");
  location.href = "login.html";
};
