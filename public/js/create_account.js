import { getAuth, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { app } from './firebase.js';

const auth = getAuth(app);
const db = getFirestore(app);

document.getElementById("create").addEventListener("click", async () => {
  const email = document.getElementById("email").value;
  const name = document.getElementById("name").value;
  const birthday = document.getElementById("birthday").value;
  const nickname = document.getElementById("nickname").value;
  const password = document.getElementById("password").value;
  const group = Array.from(document.querySelectorAll("input[type=checkbox]:checked")).map(c => c.value);
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const uid = userCredential.user.uid;
    await setDoc(doc(db, "users", uid), { email, name, birthday, nickname, group });
    document.getElementById("status").innerText = "帳號建立成功！";
  } catch (e) {
    document.getElementById("status").innerText = "建立失敗：" + e.message;
  }
});
