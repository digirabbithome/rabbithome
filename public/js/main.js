
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
