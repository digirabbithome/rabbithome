
document.addEventListener("DOMContentLoaded", () => {
  const userEmail = sessionStorage.getItem("userEmail") || "花花";
  document.getElementById("nickname").textContent = `Hello，${userEmail}！`;
});
