
import { db } from '/js/firebase.js'
import { collection, getDocs } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'

let currentPage = 1;
const itemsPerPage = 5;
let sortField = 'createdAt';
let sortDirection = 'desc';

function sortData(data) {
  return data.sort((a, b) => {
    let aVal = a[sortField];
    let bVal = b[sortField];

    if (sortField === 'createdAt') {
      aVal = aVal?.toDate?.() || new Date(0);
      bVal = bVal?.toDate?.() || new Date(0);
    }

    if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });
}

function renderPagination(totalItems) {
  const pagination = document.getElementById('pagination');
  if (!pagination) return;

  const totalPages = Math.ceil(totalItems / itemsPerPage);
  pagination.innerHTML = '';

  if (totalPages <= 1) return;

  const prevBtn = document.createElement('button');
  prevBtn.textContent = '上一頁';
  prevBtn.disabled = currentPage === 1;
  prevBtn.onclick = () => { currentPage--; renderTable(); };
  pagination.appendChild(prevBtn);

  const nextBtn = document.createElement('button');
  nextBtn.textContent = '下一頁';
  nextBtn.disabled = currentPage === totalPages;
  nextBtn.onclick = () => { currentPage++; renderTable(); };
  pagination.appendChild(nextBtn);
}

function renderTable() {
  const tbody = document.getElementById('sign-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  const filteredData = sortData(window.signData || []);
  const startIdx = (currentPage - 1) * itemsPerPage;
  const paginatedData = filteredData.slice(startIdx, startIdx + itemsPerPage);

  paginatedData.forEach(d => {
    const tr = document.createElement('tr');
    const date = d.createdAt?.toDate?.().toLocaleDateString?.() || '';
    tr.innerHTML = `
      <td>${date}</td>
      <td>${d.shortName || ''}</td>
      <td>${d.note || ''}</td>
      <td>${d.amount || ''}</td>
      <td>${d.nickname || ''}</td>
      <td>${d.signatureUrl ? `<img src="${d.signatureUrl}" style="height:40px;">` : ''}</td>
    `;
    tbody.appendChild(tr);
  });

  renderPagination(filteredData.length);
}

window.onload = async () => {
  const snapshot = await getDocs(collection(db, 'signs'));
  window.signData = snapshot.docs.map(doc => doc.data());
  renderTable();

  document.querySelectorAll('th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
      const field = th.dataset.sort;
      if (sortField === field) {
        sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
      } else {
        sortField = field;
        sortDirection = 'asc';
      }
      renderTable();
    });
  });
};
