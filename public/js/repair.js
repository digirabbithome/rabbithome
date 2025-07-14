
 db, storage } from '/js/firebase.js'
import {
  collection, getDocs, query, orderBy, doc, setDoc, serverTimestamp, getDoc
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'
import {
  ref, uploadBytes, getDownloadURL
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-storage.js'

let photoURLs = []
let repairData = []
let sortField = 'createdAt'
let sortDirection = 'desc'

function renderTable() {
  const listDiv = document.getElementById('repair-list')
  const keyword1 = document.getElementById('search-id')?.value.trim().toLowerCase() || ''
  const keyword2 = document.getElementById('search-keyword')?.value.trim().toLowerCase() || ''
  const selectedStatus = window.currentStatusFilter || 'all'

  let rows = repairData.map(d => {
  const nameDisplay =
    d.customer && d.line ? `${d.customer} / ${d.line}` :
    d.line ? d.line :
    d.customer || '';
    const match1 = d.repairId?.toLowerCase().includes(keyword1)
    const match2 = [d.customer, d.phone, d.address, d.supplier, d.product, d.description, d.line]
      .some(field => field?.toLowerCase().includes(keyword2))
    const statusMatch =
  selectedStatus === 'priority' ? d.priority === true :
      selectedStatus === 'all' ||
      (Array.isArray(selectedStatus)
        ? selectedStatus.includes(String(d.status))
        : String(d.status) === selectedStatus)
    if (!match1 || !match2 || !statusMatch) return null

    const date = d.createdAt?.toDate?.()
    const diffDays = date ? Math.floor((new Date() - date) / (1000 * 60 * 60 * 24)) : 0
    const dayClass = diffDays > 7 ? 'red-bg' : ''
    const desc = d.description?.length > 15 ? d.description.slice(0, 15) + '…' : d.description

    return {
    nameDisplay,
      priority: d.priority === true,
      createdAt: date || new Date(0),
      repairId: d.repairId || '',
      customer: d.customer || '',
      supplier: (d.supplier || '').substring(0, 4),
      product: d.product || '',
      description: desc || '',
      status: d.status || 0,
      statusText: (
        d.status === 1 ? '新進維修' :
        d.status === 2 ? '已交付廠商' :
        d.status === 3 ? '維修完成' :
        d.status === 4 ? '客人已取回' :
        d.status === 3.1 ? '廠商退回' :
        '❓'
      ),
      diffDays,
      dayClass
    }
  }).filter(r => r !== null)

  rows.sort((a, b) => {
    let valA = a[sortField]
    let valB = b[sortField]
    if (typeof valA === 'string') valA = valA.toLowerCase()
    if (typeof valB === 'string') valB = valB.toLowerCase()
    if (valA < valB) return sortDirection === 'asc' ? -1 : 1
    if (valA > valB) return sortDirection === 'asc' ? 1 : -1
    return 0
  })

  const arrow = sortDirection === 'asc' ? '▲' : '▼'
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
  </tr></thead><tbody>`

  let html = header
  rows.forEach(row => {
    html += `<tr>
      <td>${row.createdAt.getFullYear()}/${row.createdAt.getMonth() + 1}/${row.createdAt.getDate()}</td>
      <td><span class="priority-star" data-id="${row.repairId}" style="cursor:pointer;">${row.priority ? "⭐️" : "☆"}</span> <a href="repair-edit.html?id=${row.repairId}">${row.repairId}</a></td>
      <td>${row.customer}</td>
      <td>${row.supplier}</td>
      <td>${row.product}</td>
      <td>${row.description}</td>
      <td>${row.statusText}</td>
      <td class="${row.dayClass}">${row.diffDays}</td>
    </tr>`
  })
  html += '</tbody></table>'
  listDiv.innerHTML = html
// 綁定星星 click 事件
  document.querySelectorAll('.priority-star').forEach(star => {
    star.onclick = async () => {
      const id = star.dataset.id;
      const isActive = star.textContent === '⭐️';
      const newStatus = !isActive;

      // 更新 Firestore
  setDoc(doc(db, 'repairs', id), {
        priority: newStatus
      }, { merge: true });

      // 重新載入資料
      loadRepairList();
    };
  });

  document.querySelectorAll('th[data-sort]').forEach(th => {
    th.onclick = () => {
      const field = th.dataset.sort
      if (sortField === field) {
        sortDirection = sortDirection === 'asc' ? 'desc' : 'asc'
      } else {
        sortField = field
        sortDirection = 'asc'
      }
      renderTable()
    }
  })
}

async function loadRepairList() {
  const q2 = query(collection(db, 'repairs'), orderBy('createdAt', 'desc'))
  const snapshot = await getDocs(q2)
  repairData = snapshot.docs.map(doc => doc.data())
  renderTable()
}

window.onload = async () => {
  // ✅ 預設狀態 1＋2 顯示
  window.currentStatusFilter = ['1', '2']

  document.querySelectorAll('.status-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.status-btn').forEach(b => b.classList.remove('active'))
      btn.classList.add('active')
      window.currentStatusFilter = btn.dataset.status
      renderTable()
    })
  })

  document.getElementById('search-id')?.addEventListener('input', renderTable)
  document.getElementById('search-keyword')?.addEventListener('input', renderTable)

  document.getElementById('generate-id')?.addEventListener('click', async () => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const prefix = `${yyyy}${mm}${dd}`;

    const q = query(collection(db, 'repairs'), orderBy('repairId'));
    const snapshot = await getDocs(q);
    let count = 0;
    snapshot.forEach(doc => {
      const id = doc.id;
      if (id.startsWith(prefix)) {
        count++;
      }
    });

    const newId = prefix + String(count + 1).padStart(2, '0');
    document.getElementById('repair-id').value = newId;
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

    if (!repairId || (!customer && !line)) {
      alert('請填寫維修單號，並填寫客人姓名或 LINE 名稱其中之一');
      return;
    }


const phone = document.getElementById('phone').value.trim();
    const address = document.getElementById('address').value.trim();
    const product = document.getElementById('product').value.trim();
    const description = document.getElementById('description').value.trim();
    const warranty = document.getElementById('warranty-select')?.value || '';
    const supplierSelect = document.getElementById('supplier-select');
    const supplier = supplierSelect && supplierSelect.selectedIndex > 0 ? supplierSelect.value : '';

    const check = await getDoc(doc(db, 'repairs', repairId));
    if (check.exists()) {
      alert('⚠️ 此維修單號已存在，請更換！');
      return;
    }

    const data = {
      line,
      line,
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
      photos: photoURLs,
      user: localStorage.getItem('nickname') || '未知使用者'
    };

  setDoc(doc(db, 'repairs', repairId), data);
    alert('✅ 維修單送出成功！');
    document.getElementById('repair-form').reset();
    photoURLs = [];
    document.getElementById('show-list')?.click();
    loadRepairList();
  });

  loadRepairList();
}
