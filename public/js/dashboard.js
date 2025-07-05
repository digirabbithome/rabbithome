import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-auth.js";
import { app } from "./firebase-init.js";

const auth = getAuth(app);
const greeting = document.getElementById("user-greeting");
const contentArea = document.getElementById("content-area");

onAuthStateChanged(auth, (user) => {
    if (user) {
        const displayName = user.displayName || user.email.split('@')[0];
        greeting.textContent = `Hello: ${displayName}`;
    } else {
        window.location.href = "index.html";
    }
});

document.getElementById("btn-logout").addEventListener("click", () => {
    signOut(auth).then(() => {
        window.location.href = "index.html";
    });
});

document.getElementById("btn-daily").addEventListener("click", () => {
    contentArea.innerHTML = "<h2>📋 每日工作</h2><p>這裡將顯示每日工作清單與完成按鈕。</p>";
});

document.getElementById("btn-envelope").addEventListener("click", () => {
    contentArea.innerHTML = "<h2>✉️ 信封列印</h2><p>信封列印功能尚未實作。</p>";
});

document.getElementById("btn-progress").addEventListener("click", () => {
    contentArea.innerHTML = "<h2>📈 工作進度</h2><p>這裡會顯示每日工作完成紀錄與補登功能。</p>";
});
