
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { getFirestore, collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

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

function formatDataBlock(title, dataArray) {
  return `
    <div class="block">
      <h4>${title}</h4>
      <ul>${dataArray.map(item => `<li>${item}</li>`).join("")}</ul>
    </div>
  `;
}

async function loadData(dateStr) {
  document.getElementById("selectedDate").innerText = `📅 ${dateStr} 的競品偵查資料`;

  const docRef = collection(db, "competitorData");
  const q = query(docRef, where("date", "==", dateStr));
  const querySnapshot = await getDocs(q);

  let sales = [], prices = [], reviews = [], hot = [];

  querySnapshot.forEach(doc => {
    const d = doc.data();
    sales = d.salesChanges || [];
    prices = d.priceChanges || [];
    reviews = d.newReviews || [];
    hot = d.hotProducts || [];
  });

  document.getElementById("salesChanges").innerHTML = formatDataBlock("📈 銷售數變化", sales);
  document.getElementById("priceChanges").innerHTML = formatDataBlock("💰 價格變動", prices);
  document.getElementById("newReviews").innerHTML = formatDataBlock("💬 新增評價", reviews);
  document.getElementById("hotProducts").innerHTML = formatDataBlock("🔥 熱賣商品排行榜", hot);
}

function getYesterdayStr() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split("T")[0];
}

document.getElementById("datePicker").addEventListener("change", e => {
  loadData(e.target.value);
});

// 初次載入昨日資料
loadData(getYesterdayStr());
