
import { auth, db } from './firebase-init.js';
import { signOut } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

window.addEventListener("DOMContentLoaded", async () => {
  const user = auth.currentUser;

  if (!user) {
    location.href = "/login.html";
    return;
  }

  const uid = user.uid;
  const docRef = doc(db, "users", uid);
  const docSnap = await getDoc(docRef);

  if (docSnap.exists()) {
    const nickname = docSnap.data().nickname || "使用者";
    document.getElementById("user-nickname").innerText = `Hello, ${nickname}！`;
  } else {
    document.getElementById("user-nickname").innerText = "Hello, 未知使用者！";
  }
});

window.logout = async function () {
  await signOut(auth);
  alert("已登出！");
  location.href = "/login.html";
};

window.loadPage = function (page) {
  const content = document.getElementById("main-content");
  switch (page) {
    case 'daily':
      content.innerHTML = "<h2>每日工作</h2><p>這裡是每日工作內容。</p>"; break;
    case 'progress':
      content.innerHTML = "<h2>工作進度</h2><p>這裡是工作進度頁。</p>"; break;
    case 'add-user':
      content.innerHTML = "<h2>新增帳號</h2><p>功能建置中...</p>"; break;
    case 'members':
      content.innerHTML = "<h2>會員管理</h2><p>功能建置中...</p>"; break;
    case 'envelope':
      content.innerHTML = "<h2>列印信封</h2><p>功能建置中...</p>"; break;
  }
};
