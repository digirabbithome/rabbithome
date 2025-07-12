
import { db, storage } from '/js/firebase.js'
import {
  collection, getDocs, query, orderBy, doc, setDoc, serverTimestamp, getDoc
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'
import {
  ref, uploadBytes, getDownloadURL
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-storage.js'

let photoURLs = [];
let repairData = [];
let sortField = 'createdAt';
let sortDirection = 'desc';

function renderTable() {
  const listDiv = document.getElementById('repair-list');
  const keyword1 = document.getElementById('search-id')?.value.trim().toLowerCase() || '';
  const keyword2 = document.getElementById('search-keyword')?.value.trim().toLowerCase() || '';
  const selectedStatus = window.currentStatusFilter || 'all';

  let rows = repairData.map(d => {
    const keywordMatch = [d.repairId, d.customer, d.phone, d.address, d.supplier, d.product, d.description]
      .some(field => field?.toLowerCase().includes(keyword1)) &&
      [d.customer, d.phone, d.address, d.supplier, d.product, d.description]
      .some(field => field?.toLowerCase().includes(keyword2));
    const statusMatch = selectedStatus === 'all' || String(d.status) === selectedStatus;
    if (!keywordMatch || !statusMatch) return null;

    const date = d.createdAt?.toDate?.();
    const dateStr = date ? `${date.getFullYear()}/${date.getMonth()+1}/${date.getDate()}` : '';
    const diffDays = date ? Math.floor((new Date() - date) / (1000 * 60 * 60 * 24)) : 0;
    const dayClass = diffDays > 7 ? 'red-bg' : '';
    const desc = d.description?.length > 15 ? d.description.slice(0, 15) + '…' : d.description;

    return {
      createdAt: date || new Date(0),
      repairId: d.repairId || '',
      customer: d.customer || '',
      supplier: (d.supplier || '').substring(0, 4),
      product: d.product || '',
      description: desc || '',
      status: d.status || 0,
      statusText: ['❓','新進','已交廠商','完成','已取貨'][d.status] || '❓',
      diffDays,
      dayClass,
      icon: ['➡️','✅','↩️','📦'][d.status] || ''
    };
  }).filter(r => r !== null);

  rows.sort((a, b) => {
    let valA = a[sortField];
    let valB = b[sortField];
    if (typeof valA === 'string') valA = valA.toLowerCase();
    if (typeof valB === 'string') valB = valB.toLowerCase();
    if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
    if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  const arrow = sortDirection === 'asc' ? '▲' : '▼';
  const header = `
  <table><thead><tr>
    <th data-sort="createdAt">送修時間 ${sortField==='createdAt'?arrow:''}</th>
    <th data-sort="repairId">維修單號 ${sortField==='repairId'?arrow:''}</th>
    <th data-sort="customer">姓名 ${sortField==='customer'?arrow:''}</th>
    <th data-sort="supplier">廠商 ${sortField==='supplier'?arrow:''}</th>
    <th data-sort="product">商品 ${sortField==='product'?arrow:''}</th>
    <th data-sort="description">描述 ${sortField==='description'?arrow:''}</th>
    <th data-sort="status">狀態 ${sortField==='status'?arrow:''}</th>
    <th data-sort="diffDays">維修天數 ${sortField==='diffDays'?arrow:''}</th>
    <th>編輯</th>
  </tr></thead><tbody>`;

  let html = header;
  rows.forEach(row => {
    html += `<tr>
      <td>${row.createdAt.getFullYear()}/${row.createdAt.getMonth()+1}/${row.createdAt.getDate()}</td>
      <td>${row.repairId}</td>
      <td>${row.customer}</td>
      <td>${row.supplier}</td>
      <td>${row.product}</td>
      <td>${row.description}</td>
      <td>${row.statusText}</td>
      <td class="${row.dayClass}">${row.diffDays}</td>
      <td>${row.icon}</td>
    </tr>`;
  });
  html += '</tbody></table>';
  listDiv.innerHTML = html;

  document.querySelectorAll('th[data-sort]').forEach(th => {
    th.onclick = () => {
      const field = th.dataset.sort;
      if (sortField === field) {
        sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
      } else {
        sortField = field;
        sortDirection = 'asc';
      }
      renderTable();
    };
  });
}

async function loadRepairList() {
  const q2 = query(collection(db, 'repairs'), orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q2);
  repairData = snapshot.docs.map(doc => doc.data());
  renderTable();
}

window.onload = () => {
  document.querySelectorAll('.status-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.status-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      window.currentStatusFilter = btn.dataset.status;
      renderTable();
    });
  });
  document.getElementById('search-id')?.addEventListener('input', renderTable);
  document.getElementById('search-keyword')?.addEventListener('input', renderTable);
  loadRepairList();
};
