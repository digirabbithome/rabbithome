import { auth, db } from './firebase.js';
import { signOut } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

document.addEventListener('DOMContentLoaded', async () => {
  const user = auth.currentUser;
  if (user) {
    const uid = user.uid;
    const userDoc = await getDoc(doc(db, "users", uid));
    const nickname = userDoc.exists() ? userDoc.data().nickname : user.email;
    document.getElementById('user-nickname').textContent = `Hello，${nickname}！`;
  }

  const logoutButton = document.getElementById('logout-button');
  if (logoutButton) {
    logoutButton.addEventListener('click', async () => {
      await signOut(auth);
      window.location.href = 'login.html';
    });
  }
});
