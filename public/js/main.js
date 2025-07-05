function showSection(id) {
  document.querySelectorAll(".section").forEach(div => div.style.display = "none");
  document.getElementById(id).style.display = "block";
}
function logout() {
  firebase.auth().signOut().then(() => {
    window.location.href = "login.html";
  });
}
firebase.auth().onAuthStateChanged((user) => {
  if (user) {
    const nickname = user.displayName || "使用者";
    document.getElementById("welcome").innerText = `Hello，${nickname}！`;
  }
});
