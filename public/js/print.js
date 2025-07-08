
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyANuDJyJuQbxnXq-FTyaTAI9mSc6zpmuWs",
  authDomain: "rabbithome-auth.firebaseapp.com",
  projectId: "rabbithome-auth",
  storageBucket: "rabbithome-auth.appspot.com",
  messagingSenderId: "50928677930",
  appId: "1:50928677930:web:e8eff13c8028b888537f53"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

window.addEventListener('load', async () => {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  if (!id) {
    document.body.innerHTML = "<h2>❌ 錯誤：未提供信封資料 ID</h2>";
    return;
  }

  const docRef = doc(db, "envelopes", id);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) {
    document.body.innerHTML = "<h2>❌ 錯誤：找不到對應的信封資料</h2>";
    return;
  }

  const data = docSnap.data();

  // 建立畫面
  document.body.innerHTML = `
    <div style="width: 100%; padding: 2em; font-family: sans-serif;">
      <div style="display: flex; justify-content: space-between;">
        <div style="text-align: left;">
          <strong>${data.senderName || "數位小兔 Digital Rabbit"}</strong><br>
          ${data.senderAddress || "台北市信義區大道路74巷1號"}<br>
          ${data.senderPhone || "☎️ 02-27592006 / 02-27592013"}<br>
          ${data.senderLine || "LINE：@digirabbit"}
        </div>
        <img src="/img/logo.png" style="height: 100px;">
        <div style="text-align: left;">
          <strong>TO：${data.name || ""}</strong><br>
          ${data.phone || ""}<br>
          ${data.address || ""}<br>
        </div>
      </div>
      <div style="margin-top: 2em;">
        ${data.product ? `<strong>${data.product}</strong>` : ""}
      </div>
    </div>
  `;

  setTimeout(() => window.print(), 800);
});
