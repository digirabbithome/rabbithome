
import { db } from '/js/firebase.js';
import {
  collection, getDocs, doc, setDoc, serverTimestamp, query, orderBy
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';

const repairList = document.getElementById('repair-list');
const tabs = document.getElementById('tabs');
const form = document.getElementById('repair-form');
const filterState = document.getElementById('state-filter');
const nickname = localStorage.getItem('nickname') || '未知';

let allRepairs = [];

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
  let filtered = allRepairs;
  if (state !== 'all') {
    filtered = allRepairs.filter(r => (r.status || 1).toString() === state);
  }

  repairList.innerHTML = filtered.map(r => `
    <div style="padding:10px;border-bottom:1px solid #eee">
      <b>${r.repairID}</b>｜${r.supplier || ''}｜狀態 ${r.status || 1}
      <br><small>${r.contact || ''}</small>
      <br><button onclick="location.href='repair-edit.html?id=${r.repairID}'">編輯</button>
    </div>
  `).join('');
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const repairID = document.getElementById('repairID').value.trim();
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

filterState.addEventListener('change', renderRepairs);

loadRepairs();
