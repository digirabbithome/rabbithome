
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

const auth = getAuth();
const db = getFirestore();

onAuthStateChanged(auth, async (user) => {
  if (user) {
    const docRef = doc(db, "users", user.uid);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const nickname = docSnap.data().nickname || "使用者";
      document.getElementById("nickname").innerText = `Hello，${nickname}！`;
    } else {
      document.getElementById("nickname").innerText = "Hello，使用者！";
    }
  }
});
