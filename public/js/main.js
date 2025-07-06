
function getNicknameFromStorage() {
  const user = JSON.parse(sessionStorage.getItem("user"));
  if (!user) return "使用者";
  return user.displayName || "使用者";
}

document.getElementById("welcome").textContent = "🙋‍♂️ Hello，" + getNicknameFromStorage() + "！";

window.showSection = function (id) {
  document.querySelectorAll(".section").forEach((sec) => (sec.style.display = "none"));
  document.getElementById(id).style.display = "block";
};

window.logout = function () {
  sessionStorage.clear();
  window.location.href = "login.html";
};
