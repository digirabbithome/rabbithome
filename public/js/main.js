
window.navigate = function (url) {
  document.getElementById("content-frame").src = url;
};

window.toggleMenu = function (id) {
  const el = document.getElementById(id);
  el.style.display = (el.style.display === "none") ? "block" : "none";
};

window.logout = function () {
  localStorage.removeItem("nickname");
  window.location.href = "login.html";
};

window.onload = function () {
  const nickname = localStorage.getItem("nickname") || "使用者";
  document.getElementById("nickname-display").textContent = `🙋‍♂️ ${nickname}`;
};
