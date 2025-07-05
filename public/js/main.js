
import { auth } from './js/firebase-init.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js';
import { getFirestore, doc, getDocs, collection } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';

const db = getFirestore();

window.addEventListener("DOMContentLoaded", async () => {
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      const email = user.email;
      const nicknameSnapshot = await getDocs(collection(db, "nicknames"));
      let nickname = email;
      nicknameSnapshot.forEach(docSnap => {
        const data = docSnap.data();
        if (data[email]) {
          nickname = data[email];
        }
      });
      document.getElementById("nickname").innerText = `Hello, ${nickname}！`;
    }
  });
});
