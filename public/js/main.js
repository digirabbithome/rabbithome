
import { auth, db } from './firebase-init.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

const nicknameSpan = document.getElementById('nickname');
const contentDiv = document.getElementById('content');
const addUserDiv = document.getElementById('add-user-container');
const memberDiv = document.getElementById('member-management-container');

document.getElementById('btn-logout').addEventListener('click', async () => {
  await signOut(auth);
  window.location.href = 'login.html';
});

document.getElementById('btn-add-user').addEventListener('click', () => {
  contentDiv.style.display = 'none';
  memberDiv.style.display = 'none';
  addUserDiv.style.display = 'block';
  addUserDiv.innerHTML = '<p>這裡是新增帳號區，待開發...</p>';
});

document.getElementById('btn-member').addEventListener('click', () => {
  contentDiv.style.display = 'none';
  addUserDiv.style.display = 'none';
  memberDiv.style.display = 'block';
  memberDiv.innerHTML = '<p>這裡是會員管理區，待開發...</p>';
});

onAuthStateChanged(auth, async (user) => {
  if (user) {
    const docSnap = await getDoc(doc(db, "users", user.uid));
    if (docSnap.exists()) {
      nicknameSpan.innerText = docSnap.data().nickname || '使用者';
    } else {
      nicknameSpan.innerText = '使用者';
    }
  } else {
    window.location.href = 'login.html';
  }
});
