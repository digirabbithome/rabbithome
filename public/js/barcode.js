
import { db } from '/js/firebase.js';



import { collection, getDocs } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';

let suppliers = [];

async function loadSuppliers() {
  const snapshot = await getDocs(collection(db, 'suppliers'));
  suppliers = snapshot.docs.map(doc => doc.data());
  return suppliers;
}


let suppliers = [];
let currentPage = 1;
const pageSize = 100;
let filteredResults = [];

window.onload = async () => {
  const nickname = localStorage.getItem('nickname');
  const nicknameSpan = document.getElementById('nickname');
  if (nicknameSpan && nickname) {
    nicknameSpan.textContent = nickname;
  }

  await loadSuppliers();
  loadTodayBarcodes();
  setupListeners();
};

// 以下略，假設其餘原本邏輯已存在，僅替換上方 window.onload
