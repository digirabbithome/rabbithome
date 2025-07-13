// Firestore 與 Storage 引入
import { db, storage } from '/js/firebase.js'
import {
  collection, getDocs, query, orderBy, doc, setDoc, serverTimestamp, getDoc, updateDoc
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
    const match1 = d.repairId?.toLowerCase().includes(keyword1)
    const match2 = [d.customer, d.phone, d.address, d.supplier, d.product, d.description].some(field => field?.toLowerCase().includes(keyword2))
    const statusMatch = selectedStatus === 'all' || String(d.status) === selectedStatus
    if (!match1 || !match2 || !statusMatch) return null

    const date = d.createdAt?.toDate?.()
    const dateStr = date ? `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}` : ''
    const diffDays = date ? Math.floor((new Date() - date) / (1000 * 60 * 60 * 24)) : 0
    const dayClass = diffDays > 7 ? 'red-bg' : ''
    const desc = d.description?.length > 15 ? d.description.slice(0, 15) + '…' : d.description

    const statusOptions = [1, 2, 3, 31, 4].map(val => {
      const label = ['新進', '已交廠商', '維修完成', '廠商退回', '已取貨'][val - 1]
      return `<option value="${val}" ${d.status === val ? 'selected' : ''}>${label}</option>`
    }).join('')

    const statusControl = `<select class="status-select" data-id="${d.repairId}" ${d.status === 4 ? 'disabled' : ''}>${statusOptions}</select>`

    return {
      statusControl,
      createdAt: date || new Date(0),
      repairId: d.repairId || '',
      customer: d.customer || '',
      supplier: (d.supplier || '').substring(0, 4),
      product: d.product || '',
      description: desc || '',
      status: d.status || 0,
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
    <th data-sort="createdAt">送修時間 ${sortField === 'createdAt' ? arrow : ''}</th>
    <th data-sort="repairId">維修單號 ${sortField === 'repairId' ? arrow : ''}</th>
    <th data-sort="customer">姓名 ${sortField === 'customer' ? arrow : ''}</th>
    <th data-sort="supplier">廠商 ${sortField === 'supplier' ? arrow : ''}</th>
    <th data-sort="product">商品 ${sortField === 'product' ? arrow : ''}</th>
    <th data-sort="description">描述 ${sortField === 'description' ? arrow : ''}</th>
    <th data-sort="status">狀態 ${sortField === 'status' ? arrow : ''}</th>
    <th data-sort="diffDays">維修天數 ${sortField === 'diffDays' ? arrow : ''}</th>
    <th>編輯</th>
  </tr></thead><tbody>`

  let html = header
  rows.forEach(row => {
    html += `<tr>
      <td>${row.createdAt.getFullYear()}/${row.createdAt.getMonth() + 1}/${row.createdAt.getDate()}</td>
      <td><a href="repair-edit.html?id=${row.repairId}" target="_blank">${row.repairId}</a></td>
      <td>${row.customer}</td>
      <td>${row.supplier}</td>
      <td>${row.product}</td>
      <td>${row.description}</td>
      <td>${row.statusControl}</td>
      <td class="${row.dayClass}">${row.diffDays}</td>
      <td></td>
    </tr>`
  })
  html += '</tbody></table>'
  listDiv.innerHTML = html

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
      loadRepairList()
    }
  })

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
  const q = query(collection(db, 'repairs'), orderBy('createdAt', 'desc'))
  const snapshot = await getDocs(q)
  repairData = snapshot.docs.map(doc => doc.data())
  renderTable()
}

window.onload = async () => {
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

  loadRepairList()
}


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
  