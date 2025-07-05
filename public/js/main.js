import { auth } from './firebase-init.js';
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";

const db = getFirestore();

onAuthStateChanged(auth, async (user) => {
  if (user) {
    const uid = user.uid;
    const userDoc = await getDoc(doc(db, "users", uid));
    const nickname = userDoc.exists() ? userDoc.data().nickname : "未知使用者";
    document.getElementById("greeting").textContent = "Hello, " + nickname;
  } else {
    window.location.href = "/login.html";
  }
});

document.getElementById("logoutBtn").addEventListener("click", async () => {
  await signOut(auth);
  localStorage.removeItem("uid");
  window.location.href = "/login.html";
});
