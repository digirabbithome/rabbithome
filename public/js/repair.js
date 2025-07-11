
import { db } from '/js/firebase.js'
import {
  collection, getDocs, query, orderBy
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'

window.onload = async () => {
  const listEl = document.getElementById('repair-list');
  const searchInput = document.getElementById('search-input');
  const statusButtons = document.querySelectorAll('.status-filter');

  let allData = [];
  let currentStatus = 'all';
  let currentPage = 1;
  const itemsPerPage = 50;

  const renderTable = (data) => {
    listEl.innerHTML = '';

    const table = document.createElement('table');
    table.classList.add('repair-table');

    const thead = document.createElement('thead');
    thead.innerHTML = `
      <tr>
        <th>維修單號</th>
        <th>客人姓名</th>
        <th>廠商</th>
        <th>狀態</th>
        <th>建立時間</th>
        <th>維修天數</th>
        <th>編輯</th>
      </tr>
    `;
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    data.forEach(item => {
      const tr = document.createElement('tr');
      const createdAt = item.createdAt?.toDate?.() || null;
      const daysElapsed = createdAt
        ? Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24))
        : '-';

      tr.innerHTML = `
        <td><a href="repair-edit.html?id=${item.repairId}" target="_blank">${item.repairId}</a></td>
        <td>${item.customer || ''}</td>
        <td>${item.supplier || ''}</td>
        <td>${getStatusText(item.status)}</td>
        <td>${createdAt ? createdAt.toLocaleString() : '-'}</td>
        <td>${daysElapsed} 天</td>
        <td><a href="repair-edit.html?id=${item.repairId}" target="_blank">編輯</a></td>
      `;
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    listEl.appendChild(table);
  };

  const getStatusText = (status) => {
    switch (status) {
      case 1: return '新進維修';
      case 2: return '已交付廠商';
      case 3: return '維修完成';
      case 4: return '客人已取貨';
      default: return '-';
    }
  };

  const filterData = () => {
    let filtered = [...allData];
    const keyword = searchInput.value.trim().toLowerCase();

    if (currentStatus !== 'all') {
      filtered = filtered.filter(item => item.status === parseInt(currentStatus));
    }

    if (keyword) {
      filtered = filtered.filter(item =>
        (item.repairId || '').toLowerCase().includes(keyword) ||
        (item.customer || '').toLowerCase().includes(keyword) ||
        (item.supplier || '').toLowerCase().includes(keyword)
      );
    }

    const start = (currentPage - 1) * itemsPerPage;
    const paginated = filtered.slice(start, start + itemsPerPage);

    renderTable(paginated);
    renderPagination(filtered.length);
  };

  const renderPagination = (totalItems) => {
    const paginationEl = document.getElementById('pagination');
    paginationEl.innerHTML = '';
    const totalPages = Math.ceil(totalItems / itemsPerPage);

    if (totalPages <= 1) return;

    const prevBtn = document.createElement('button');
    prevBtn.textContent = '上一頁';
    prevBtn.disabled = currentPage === 1;
    prevBtn.onclick = () => {
      currentPage--;
      filterData();
    };
    paginationEl.appendChild(prevBtn);

    const info = document.createElement('span');
    info.textContent = `第 ${currentPage} 頁 / 共 ${totalPages} 頁`;
    paginationEl.appendChild(info);

    const nextBtn = document.createElement('button');
    nextBtn.textContent = '下一頁';
    nextBtn.disabled = currentPage === totalPages;
    nextBtn.onclick = () => {
      currentPage++;
      filterData();
    };
    paginationEl.appendChild(nextBtn);
  };

  searchInput.addEventListener('input', () => {
    currentPage = 1;
    filterData();
  });

  statusButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      currentStatus = btn.dataset.status;
      currentPage = 1;
      filterData();
    });
  });

  // 撈資料
  const q = query(collection(db, 'repairs'), orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  allData = snapshot.docs.map(doc => doc.data());

  filterData();
};
