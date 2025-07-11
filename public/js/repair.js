
import { db } from '/js/firebase.js';
import {
  collection, getDocs, doc, setDoc, serverTimestamp, query, orderBy
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';

const repairList = document.getElementById('repair-list');
const form = document.getElementById('repair-form');
const filterState = document.getElementById('state-filter');
const searchInput = document.getElementById('search');
const repairIDInput = document.getElementById('repairID');
const nickname = localStorage.getItem('nickname') || '未知';
const pageInfo = document.getElementById('page-info');

let allRepairs = [];
let currentPage = 1;
const pageSize = 50;

async function loadSuppliers() {
  const supplierSelect = document.getElementById('supplier');
  const q = query(collection(db, 'suppliers'));
  const querySnapshot = await getDocs(q);
  querySnapshot.forEach(doc => {
    const name = doc.data().name || doc.data().code;
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    supplierSelect.appendChild(opt);
  });
}

async function loadRepairs() {
  const q = query(collection(db, 'repairs'), orderBy('repairID', 'desc'));
  const querySnapshot = await getDocs(q);
  allRepairs = [];
  querySnapshot.forEach(doc => {
    allRepairs.push(doc.data());
  });
  renderRepairs();
}

function renderRepairs() {
  const state = filterState.value;
  const keyword = searchInput.value.toLowerCase();

  let filtered = allRepairs;
  if (state !== 'all') {
    filtered = filtered.filter(r => (r.status || 1).toString() === state);
  }
  if (keyword) {
    filtered = filtered.filter(r =>
      (r.repairID || '').toLowerCase().includes(keyword) ||
      (r.supplier || '').toLowerCase().includes(keyword) ||
      (r.contact || '').toLowerCase().includes(keyword) ||
      (r.description || '').toLowerCase().includes(keyword)
    );
  }

  const start = (currentPage - 1) * pageSize;
  const pageData = filtered.slice(start, start + pageSize);

  repairList.innerHTML = pageData.map(r => `
    <div style="padding:10px;border-bottom:1px solid #eee">
      <b>${r.repairID}</b>｜${r.supplier || ''}｜狀態 ${r.status || 1}
      <br><small>${r.contact || ''}</small>
      <br><button onclick="location.href='repair-edit.html?id=${r.repairID}'">編輯</button>
    </div>
  `).join('');

  const totalPages = Math.ceil(filtered.length / pageSize);
  pageInfo.innerHTML = `第 ${currentPage} / ${totalPages} 頁`;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const repairID = repairIDInput.value.trim();
  const supplier = document.getElementById('supplier').value.trim();
  const contact = document.getElementById('contact').value.trim();
  const warranty = document.getElementById('warranty').value.trim();
  const description = document.getElementById('description').value.trim();

  if (!repairID) return alert('請輸入維修單號');

  await setDoc(doc(db, 'repairs', repairID), {
    repairID, supplier, contact, warranty, description,
    status: 1,
    creator: nickname,
    createdAt: serverTimestamp()
  });

  alert('新增成功！');
  form.reset();
  loadRepairs();
});

filterState.addEventListener('change', () => {
  currentPage = 1;
  renderRepairs();
});
searchInput.addEventListener('input', () => {
  currentPage = 1;
  renderRepairs();
});

document.getElementById('prev-page').addEventListener('click', () => {
  if (currentPage > 1) {
    currentPage--;
    renderRepairs();
  }
});
document.getElementById('next-page').addEventListener('click', () => {
  const totalPages = Math.ceil(allRepairs.length / pageSize);
  if (currentPage < totalPages) {
    currentPage++;
    renderRepairs();
  }
});

document.getElementById('generate-id').addEventListener('click', async () => {
  const today = new Date();
  const yyyymmdd = today.toISOString().slice(0,10).replace(/-/g, '');
  const prefix = 'REPAIR' + yyyymmdd;
  let counter = 1;
  let newID = '';
  let exists = true;
  while (exists && counter < 1000) {
    newID = prefix + String(counter).padStart(3, '0');
    const docRef = doc(db, 'repairs', newID);
    const docSnap = await getDocs(query(collection(db, 'repairs')));
    exists = docSnap.docs.some(d => d.id === newID);
    if (!exists) break;
    counter++;
  }
  repairIDInput.value = newID;
});

loadSuppliers();
loadRepairs();
