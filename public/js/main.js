import { auth, db } from './firebase.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';

window.addEventListener('DOMContentLoaded', () => {
  const greetingElement = document.getElementById('greeting');
  const logoutBtn = document.getElementById('logoutBtn');

  onAuthStateChanged(auth, async (user) => {
    if (user) {
      const userDocRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userDocRef);
      const nickname = userSnap.exists() ? userSnap.data().nickname : '使用者';
      greetingElement.textContent = `Hello，${nickname}！`;
    } else {
      window.location.href = 'login.html';
    }
  });

  logoutBtn?.addEventListener('click', () => {
    signOut(auth).then(() => {
      window.location.href = 'login.html';
    });
  });
});
