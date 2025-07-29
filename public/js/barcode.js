
import { db, auth } from '/js/firebase.js';
import {
  collection, addDoc, getDocs, query, orderBy, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';

let suppliers = [];
let currentPage = 1;
const perPage = 100;
let barcodeData = [];

async function loadSuppliers() {
  const snapshot = await getDocs(collection(db, 'suppliers'));
  suppliers = snapshot.docs.map(doc => doc.data());

  document.getElementById('supplierInput').addEventListener('input', e => {
    const keyword = e.target.value.trim().toLowerCase();
    const matched = suppliers.filter(s =>
      s.shortname.toLowerCase().includes(keyword) ||
      s.fullname.toLowerCase().includes(keyword)
    );
    const resultDiv = document.getElementById('supplierResults');
    resultDiv.innerHTML = '';
    matched.slice(0, 10).forEach(s => {
      const div = document.createElement('div');
      div.textContent = `${s.id} - ${s.shortname}`;
      div.addEventListener('click', () => {
        document.getElementById('supplierInput').value = `${s.id}-${s.shortname}`;
        resultDiv.innerHTML = '';
      });
      resultDiv.appendChild(div);
    });
  });
}

function renderResults() {
  const keyword = document.getElementById('searchInput').value.trim().toLowerCase();
  const filtered = barcodeData.filter(d =>
    (d.supplierName || '').toLowerCase().includes(keyword) ||
    (d.brand || '').toLowerCase().includes(keyword) ||
    (d.product || '').toLowerCase().includes(keyword) ||
    (d.note || '').toLowerCase().includes(keyword) ||
    (d.nickname || '').toLowerCase().includes(keyword) ||
    (d.serial || '').toLowerCase().includes(keyword)
  );

  const list = document.getElementById('resultList');
  list.innerHTML = '';

  const start = (currentPage - 1) * perPage;
  const end = start + perPage;
  const pageData = filtered.slice(start, end);

  pageData.forEach(d => {
    const div = document.createElement('div');
    div.className = 'result-item';
    div.innerHTML = `<strong>${d.serial}</strong>｜${d.supplierName || ''}｜${d.brand}｜${d.product}｜${d.note || ''}｜${d.nickname || ''}｜${d.createdAt?.toDate().toLocaleString() || ''}`;
    list.appendChild(div);
  });

  document.getElementById('pageInfo').textContent = `第 ${currentPage} 頁，共 ${Math.ceil(filtered.length / perPage)} 頁`;
}

async function loadBarcodes() {
  const q = query(collection(db, 'barcodes'), orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  barcodeData = snapshot.docs.map(doc => doc.data());
  renderResults();
}

window.onload = async () => {
  loadSuppliers();
  loadBarcodes();
  const nickname = localStorage.getItem('nickname') || '匿名';
  const nickSpan = document.getElementById('nickname');
  if (nickSpan) nickSpan.textContent = nickname;

  document.getElementById('submitBtn').addEventListener('click', async () => {
    const supplierValue = document.getElementById('supplierInput').value.trim();
    const brand = document.getElementById('brand').value.trim();
    const product = document.getElementById('product').value.trim();
    const note = document.getElementById('note').value.trim();
    const barcodes = document.getElementById('barcodes').value.trim().split('\n').filter(b => b);

    let supplierName = supplierValue;
    if (!supplierName.includes('-')) {
      const found = suppliers.find(s => s.id === supplierValue);
      if (found) supplierName = `${found.id}-${found.shortname}`;
    }

    for (let serial of barcodes) {
      await addDoc(collection(db, 'barcodes'), {
        supplierName,
        brand,
        product,
        note,
        serial,
        nickname: nickname,
        createdAt: serverTimestamp()
      });
    }
    alert('✅ 登記完成！');
    document.getElementById('barcodes').value = '';
    loadBarcodes();
  });

  document.getElementById('searchInput').addEventListener('input', () => {
    currentPage = 1;
    renderResults();
  });

  document.getElementById('prevPage').addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      renderResults();
    }
  });

  document.getElementById('nextPage').addEventListener('click', () => {
    currentPage++;
    renderResults();
  });
};
