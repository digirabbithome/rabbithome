
import { db } from '/js/firebase.js'
import {
  collection, getDocs, query, orderBy, doc, updateDoc
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'

window.addEventListener('load', async () => {
  const listEl = document.getElementById('repair-list');
  const searchInput = document.getElementById('search-input');
  const statusButtons = document.querySelectorAll('.status-filter');

  let allData = [];
  let currentStatus = 'all';
  let currentPage = 1;
  let currentSort = { key: 'createdAt', asc: false };
  const itemsPerPage = 50;

  const renderTable = (data) => {
    listEl.innerHTML = '';

    const table = document.createElement('table');
    table.classList.add('repair-table');

    const makeSortArrow = (key) => {
      if (currentSort.key !== key) return '';
      return currentSort.asc ? ' ▲' : ' ▼';
    };

    const thead = document.createElement('thead');
    thead.innerHTML = `
      <tr>
        <th data-key="createdAt">送修時間${makeSortArrow('createdAt')}</th>
        <th data-key="repairId">維修單號${makeSortArrow('repairId')}</th>
        <th data-key="customer">姓名${makeSortArrow('customer')}</th>
        <th data-key="supplier">廠商${makeSortArrow('supplier')}</th>
        <th data-key="product">商品${makeSortArrow('product')}</th>
        <th data-key="description">狀況描述${makeSortArrow('description')}</th>
        <th data-key="status">狀態${makeSortArrow('status')}</th>
        <th data-key="daysElapsed">維修天數${makeSortArrow('daysElapsed')}</th>
        <th>編輯</th>
      </tr>
    `;
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    data.forEach(item => {
      const createdAt = item.createdAt?.toDate?.() || null;
      const createdStr = createdAt ? createdAt.toLocaleDateString() : '-';
      const daysElapsed = createdAt
        ? Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24))
        : '-';
      const shortDescription = (item.description || '').substring(0, 10);
      const shortSupplier = (item.supplier || '').substring(0, 4);
      const rowClass = daysElapsed > 14 ? 'style="background-color: #ffe0e0;"' : '';

      const tr = document.createElement('tr');
      tr.setAttribute('data-id', item.repairId);
      tr.innerHTML = `
        <td>${createdStr}</td>
        <td><a href="repair-edit.html?id=${item.repairId}" target="_blank">${item.repairId}</a></td>
        <td>${item.customer || ''}</td>
        <td>${shortSupplier}</td>
        <td>${item.product || ''}</td>
        <td>${shortDescription}</td>
        <td>${getStatusText(item.status)}</td>
        <td ${rowClass}>${daysElapsed} 天</td>
        <td>
          ${makeStepMenu(item.repairId, item.status)}
        </td>
      `;
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    listEl.appendChild(table);

    // 加上欄位排序功能
    thead.querySelectorAll('th[data-key]').forEach(th => {
      th.style.cursor = 'pointer';
      th.onclick = () => {
        const key = th.dataset.key;
        if (currentSort.key === key) {
          currentSort.asc = !currentSort.asc;
        } else {
          currentSort.key = key;
          currentSort.asc = true;
        }
        filterData();
      };
    });

    // 綁定 popmenu 行為
    document.querySelectorAll('.step-select').forEach(select => {
      select.addEventListener('change', async (e) => {
        const newStatus = parseInt(e.target.value);
        const id = e.target.dataset.id;
        if (!id || isNaN(newStatus)) return;
        await updateDoc(doc(db, 'repairs', id), { status: newStatus });
        alert(`✅ 已變更 ${id} 狀態為 ${getStatusText(newStatus)}`);
        location.reload();
      });
    });
  };

  const makeStepMenu = (id, currentStatus) => {
    const options = [];
    for (let i = currentStatus + 1; i <= 4; i++) {
      options.push(`<option value="${i}">${getStatusText(i)}</option>`);
    }
    if (options.length === 0) return '-';
    return `
      <select class="step-select" data-id="${id}">
        <option value="">➡️ 選擇階段</option>
        ${options.join('')}
      </select>
    `;
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

    // 加上排序功能
    const key = currentSort.key;
    const asc = currentSort.asc;
    filtered.sort((a, b) => {
      let va = a[key], vb = b[key];
      if (key === 'createdAt') {
        va = a.createdAt?.toDate?.()?.getTime?.() || 0;
        vb = b.createdAt?.toDate?.()?.getTime?.() || 0;
      } else if (key === 'daysElapsed') {
        const ta = a.createdAt?.toDate?.() || null;
        const tb = b.createdAt?.toDate?.() || null;
        va = ta ? Math.floor((Date.now() - ta.getTime()) / (1000 * 60 * 60 * 24)) : 0;
        vb = tb ? Math.floor((Date.now() - tb.getTime()) / (1000 * 60 * 60 * 24)) : 0;
      } else {
        va = (va || '').toString().toLowerCase();
        vb = (vb || '').toString().toLowerCase();
      }
      if (va < vb) return asc ? -1 : 1;
      if (va > vb) return asc ? 1 : -1;
      return 0;
    });

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

  const q = query(collection(db, 'repairs'), orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  allData = snapshot.docs.map(doc => doc.data());

  filterData();
};
