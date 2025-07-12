
import { db } from '/js/firebase.js'
import {
  collection, query, orderBy, getDocs
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'

let repairData = []
let sortField = 'createdAt'
let sortDirection = 'desc'

window.onload = async () => {
  const q = query(collection(db, 'repairs'), orderBy('createdAt', 'desc'))
  const snapshot = await getDocs(q)
  repairData = snapshot.docs.map(doc => doc.data())

  renderTable()

  // 排序
  document.querySelectorAll('th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
      const field = th.dataset.sort
      if (sortField === field) {
        sortDirection = sortDirection === 'asc' ? 'desc' : 'asc'
      } else {
        sortField = field
        sortDirection = 'asc'
      }
      renderTable()
    })
  })

  // 搜尋
  document.getElementById('search-id').addEventListener('input', renderTable)
  document.getElementById('search-keyword').addEventListener('input', renderTable)

  // 狀態篩選
  document.querySelectorAll('#filter-buttons button').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#filter-buttons button').forEach(b => b.classList.remove('active'))
      btn.classList.add('active')
      renderTable()
    })
  })
}

function renderTable() {
  const tbody = document.getElementById('repair-list')
  let rows = [...repairData]

  // 搜尋與篩選
  const idVal = document.getElementById('search-id').value.trim()
  const keyword = document.getElementById('search-keyword').value.trim().toLowerCase()
  const activeStatus = document.querySelector('#filter-buttons .active')?.dataset.status || 'all'

  rows = rows.filter(item => {
    const matchId = idVal ? item.repairId.includes(idVal) : true
    const matchKeyword = keyword
      ? (item.customer + item.phone + item.supplier + item.description).toLowerCase().includes(keyword)
      : true
    const matchStatus = activeStatus === 'all' ? true : String(item.status) === activeStatus
    return matchId && matchKeyword && matchStatus
  })

  // 排序
  rows.sort((a, b) => {
    const aVal = a[sortField] || ''
    const bVal = b[sortField] || ''
    if (sortDirection === 'asc') return aVal > bVal ? 1 : -1
    else return aVal < bVal ? 1 : -1
  })

  // 標題箭頭
  document.querySelectorAll('th[data-sort]').forEach(th => {
    th.classList.remove('sort-asc', 'sort-desc')
    if (th.dataset.sort === sortField) {
      th.classList.add(sortDirection === 'asc' ? 'sort-asc' : 'sort-desc')
    }
  })

  // 限制前 50 筆
  rows = rows.slice(0, 50)

  tbody.innerHTML = rows.map(item => {
    const created = item.createdAt?.toDate().toISOString().split('T')[0] || ''
    const desc = item.description?.slice(0, 10) || ''
    const days = calcDays(item.createdAt?.toDate())
    return `
      <tr>
        <td>${created}</td>
        <td>${item.repairId || ''}</td>
        <td>${item.customer || ''}</td>
        <td>${item.supplier?.slice(0, 4) || ''}</td>
        <td>${item.product || ''}</td>
        <td>${desc}</td>
        <td>${statusText(item.status)}</td>
        <td>${days}</td>
        <td>🛠️</td>
      </tr>
    `
  }).join('')
}

function statusText(status) {
  switch (status) {
    case 1: return '新進'
    case 2: return '已交付'
    case 3: return '完成'
    case 4: return '已取件'
    default: return ''
  }
}

function calcDays(date) {
  if (!date) return ''
  const now = new Date()
  const diff = Math.floor((now - date) / (1000 * 60 * 60 * 24))
  return diff
}
