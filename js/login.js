function login() {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  firebase.auth().signInWithEmailAndPassword(email, password)
    .then(() => {
      window.location.href = "main.html";
    })
    .catch((error) => {
      document.getElementById("error-message").innerText = "登入失敗：" + error.message;
    });
}
