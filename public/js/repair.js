
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

  document.querySelectorAll('.status-select').forEach(select => {
    select.onchange = async () => {
      const repairId = select.dataset.id
      const newStatus = parseInt(select.value)
      if (!repairId || isNaN(newStatus)) return
      const ref = doc(db, 'repairs', repairId)
      await updateDoc(ref, {
        status: newStatus,
        [`history.${newStatus}`]: {
          user: nickname,
          time: new Date().toISOString()
        }
      })
      alert(`✅ 狀態更新為 ${newStatus}！`)
      loadData()
    }
  })


  const listDiv = document.getElementById('repair-list');
  const keyword1 = document.getElementById('search-id')?.value.trim().toLowerCase() || '';
  const keyword2 = document.getElementById('search-keyword')?.value.trim().toLowerCase() || '';
  const selectedStatus = window.currentStatusFilter || 'all';

  let rows = repairData.map(d => {
    const match1 = d.repairId?.toLowerCase().includes(keyword1);
    const match2 = [d.customer, d.phone, d.address, d.supplier, d.product, d.description]
      .some(field => field?.toLowerCase().includes(keyword2));
    const statusMatch = selectedStatus === 'all' || String(d.status) === selectedStatus;
    if (!match1 || !match2 || !statusMatch) return null;

    const date = d.createdAt?.toDate?.();
    const dateStr = date ? `${date.getFullYear()}/${date.getMonth()+1}/${date.getDate()}` : '';
    const diffDays = date ? Math.floor((new Date() - date) / (1000 * 60 * 60 * 24)) : 0;
    const dayClass = diffDays > 7 ? 'red-bg' : '';
    const desc = d.description?.length > 15 ? d.description.slice(0, 15) + '…' : d.description;

    

let statusControl = '';
if (d.status === 1) {
  statusControl = `<span class="status-gray">🆕</span>`;
} else if (d.status === 2) {
  statusControl = `
    <button class="repair-status-btn status-blue" data-id="${d.repairId}" data-next="3">🚙</button>
    <button class="repair-status-btn status-red" data-id="${d.repairId}" data-next="31">🚗</button>
  `;
} else if (d.status === 3) {
  statusControl = `<button class="repair-status-btn status-green" data-id="${d.repairId}" data-next="4">🚘</button>`;
} else if (d.status === 31) {
  statusControl = `<button class="repair-status-btn status-red" data-id="${d.repairId}" data-next="4">🚗</button>`;
} else if (d.status === 4) {
  statusControl = `<span class="done-icon">🧍‍♂️🆗</span>`;
}

if (d.status === 1) {
  statusControl = `
    <button class="repair-status-btn" data-id="${d.repairId}" data-next="2">➡️</button>
    <button class="repair-status-btn" data-id="${d.repairId}" data-next="3">✅</button>
    <button class="repair-status-btn" data-id="${d.repairId}" data-next="31">↩️</button>
  `;
} else if (d.status === 2) {
  statusControl = `
    <button class="repair-status-btn" data-id="${d.repairId}" data-next="3">✅</button>
    <button class="repair-status-btn" data-id="${d.repairId}" data-next="31">↩️</button>
  `;
} else if (d.status === 3 || d.status === 31) {
  statusControl = `<button class="repair-status-btn" data-id="${d.repairId}" data-next="4">📦</button>`;
} else if (d.status === 4) {
  statusControl = `<span class=\"done-icon\">🆗</span>`;
  console.log('狀態:', d.status, '→', statusControl);
}



return {
      statusControl: statusControl,
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
      <td style="text-align:left">${row.createdAt.getFullYear()}/${row.createdAt.getMonth()+1}/${row.createdAt.getDate()}</td>
      <td style="text-align:left">${row.repairId}</td>
      <td style="text-align:left">${row.customer}</td>
      <td style="text-align:left">${row.supplier}</td>
      <td style="text-align:left">${row.product}</td>
      <td style="text-align:left">${row.description}</td>
      <td style="text-align:left">${row.statusText}</td>
      <td class="${row.dayClass}">${row.diffDays}</td>
      <td style="text-align:left">${row.icon}</td>
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

window.onload = async () => {
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

  document.getElementById('generate-id')?.addEventListener('click', () => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const random = Math.floor(1000 + Math.random() * 9000);
    const repairId = `R${yyyy}${mm}${dd}${random}`;
    document.getElementById('repair-id').value = repairId;
  });

  const supplierSelect = document.getElementById('supplier-select');
  const suppliersRef = collection(db, 'suppliers');
  const q = query(suppliersRef, orderBy('code'));
  const suppliersSnap = await getDocs(q);
  supplierSelect.innerHTML = '<option disabled selected>請選擇廠商</option>';
  suppliersSnap.forEach(doc => {
    const d = doc.data();
    const option = document.createElement('option');
    option.value = d.shortName || '';
    option.textContent = `${d.code || ''} - ${d.shortName || ''}`;
    supplierSelect.appendChild(option);
  });

  document.getElementById('photo-upload')?.addEventListener('change', async (event) => {
    const files = event.target.files;
    photoURLs = [];
    for (const file of files) {
      const storageRef = ref(storage, `repairs/${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      photoURLs.push(url);
    }
  });

  document.getElementById('repair-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const repairId = document.getElementById('repair-id').value.trim();
    const customer = document.getElementById('customer').value.trim();
    if (!repairId || !customer) {
      alert('請填寫維修單號與客人姓名');
      return;
    }

    const phone = document.getElementById('phone').value.trim();
    const address = document.getElementById('address').value.trim();
    const product = document.getElementById('product').value.trim();
    const description = document.getElementById('description').value.trim();
    const warranty = document.getElementById('warranty-select')?.value || '';
    const supplier = document.getElementById('supplier-select')?.value || '';

    const check = await getDoc(doc(db, 'repairs', repairId));
    if (check.exists()) {
      alert('⚠️ 此維修單號已存在，請更換！');
      return;
    }

    const data = {
      repairId,
      customer,
      phone,
      address,
      product,
      description,
      warranty,
      supplier,
      createdAt: serverTimestamp(),
      status: 1,
      photos: photoURLs
    };

    await setDoc(doc(db, 'repairs', repairId), data);
    alert('✅ 維修單送出成功！');
    document.getElementById('repair-form').reset();
    photoURLs = [];
    document.getElementById('show-list')?.click();
    loadRepairList();
  });

  loadRepairList();
};


  // 新增 select 狀態變更監聽
  document.querySelectorAll('.status-select').forEach(select => {
    select.onchange = async () => {
      const repairId = select.dataset.id
      const newStatus = parseInt(select.value)
      if (!repairId || !newStatus) return
      const ref = doc(db, 'repairs', repairId)
      await updateDoc(ref, {
        status: newStatus,
        [`history.${newStatus}`]: {
          user: nickname,
          time: new Date().toISOString()
        }
      })
      alert(`✅ 狀態更新為 ${newStatus}！`)
      loadData()
    }
  })
