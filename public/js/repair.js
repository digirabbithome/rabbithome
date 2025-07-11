
import { db } from '/js/firebase.js';
import {
  collection, getDocs, query, orderBy
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';

function getStatusText(status) {
  switch (status) {
    case 1: return "新進維修";
    case 2: return "已交付廠商";
    case 3: return "維修完成";
    case 4: return "客人已取貨";
    default: return "未知";
  }
}

async function loadRepairs() {
  const tbody = document.getElementById("repair-list");
  tbody.innerHTML = "<tr><td colspan='4'>🔄 載入中...</td></tr>";

  try {
    const q = query(collection(db, "repairs"), orderBy("created", "desc"));
    const snap = await getDocs(q);
    tbody.innerHTML = "";
    snap.forEach((docSnap) => {
      const d = docSnap.data();
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><a href="repair-edit.html?id=${d.repairID}" target="_blank">${d.repairID}</a></td>
        <td>${d.supplier || ""}</td>
        <td>${d.description || ""}</td>
        <td>${getStatusText(d.status)}</td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error("載入失敗", err);
    tbody.innerHTML = "<tr><td colspan='4'>❌ 無法載入資料</td></tr>";
  }
}

window.onload = loadRepairs;
