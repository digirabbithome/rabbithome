document.getElementById("btn-add-user").addEventListener("click", loadAddUser);

function loadAddUser() {
  fetch("public/pages/add-user.html")
    .then((res) => res.text())
    .then((html) => {
      document.getElementById("content-area").innerHTML = html;
    });
}