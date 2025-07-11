
import { db } from '/js/firebase.js';
import {
  doc, getDoc
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';

const params = new URLSearchParams(window.location.search);
const repairID = params.get("id") || "";

async function loadPrint() {
  const refDoc = doc(db, "repairs", repairID);
  const snap = await getDoc(refDoc);
  if (!snap.exists()) return alert("查無資料");

  const d = snap.data();
  document.getElementById("repairID").textContent = d.repairID || "";
  document.getElementById("supplier").textContent = d.supplier || "";
  document.getElementById("contact").textContent = d.contact || "";
  document.getElementById("warranty").textContent = d.warranty || "";
  document.getElementById("product").textContent = d.product || "";
  document.getElementById("description").textContent = d.description || "";
}

window.onload = loadPrint;
