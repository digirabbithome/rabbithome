
import { db } from '/js/firebase.js'
import { collection, getDocs, query, orderBy } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'

let allData = []
let filteredData = []
let currentPage = 1
const itemsPerPage = 20
let currentSortField = 'createdAt'
let currentSortDirection = 'desc'

function formatDate(date) {
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`
}

function applyFilter(range) {
  const now = new Date()
  let startDate
  if (range === 'today') {
    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  } else if (range === 'week') {
    const day = now.getDay() || 7
    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day + 1)
  } else if (range === 'month') {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1)
  } else {
    startDate = null
  }

  if (startDate) {
    filteredData = allData.filter(d => d.createdAt?.toDate?.() >= startDate)
  } else {
    filteredData = [...allData]
  }
  currentPage = 1
  renderTable()
}

function renderTable() {
  const tbody = document.getElementById('sign-body')
  if (!tbody) return

  const start = (currentPage - 1) * itemsPerPage
  const pageData = filteredData.slice(start, start + itemsPerPage)

  tbody.innerHTML = pageData.map(d => {
    const date = d.createdAt?.toDate?.()
    const dateStr = date ? formatDate(date) : ''
    const note = d.note || ''
    const company = d.shortName || ''
    const amount = d.amount || ''
    const user = d.nickname || ''
    const sig = d.signatureUrl ? `<img src="${d.signatureUrl}" class="thumb" />` : ''
    return `<tr>
      <td>${dateStr}</td>
      <td>${company}</td>
      <td>${note}</td>
      <td>${amount}</td>
      <td>${user}</td>
      <td>${sig}</td>
    </tr>`
  }).join('')

  renderPagination()
}

function renderPagination() {
  const totalPages = Math.ceil(filteredData.length / itemsPerPage)
  const div = document.getElementById('pagination')
  if (!div) return
  let html = ''
  for (let i = 1; i <= totalPages; i++) {
    html += `<button class="page-btn" data-page="${i}">${i}</button>`
  }
  div.innerHTML = html

  document.querySelectorAll('.page-btn').forEach(btn => {
    btn.onclick = () => {
      currentPage = Number(btn.dataset.page)
      renderTable()
    }
  })
}

function sortData(field) {
  if (field === currentSortField) {
    currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc'
  } else {
    currentSortField = field
    currentSortDirection = 'asc'
  }

  filteredData.sort((a, b) => {
    let aVal = a[field] || ''
    let bVal = b[field] || ''
    if (aVal?.toDate) aVal = aVal.toDate()
    if (bVal?.toDate) bVal = bVal.toDate()
    return currentSortDirection === 'asc'
      ? (aVal > bVal ? 1 : -1)
      : (aVal < bVal ? 1 : -1)
  })

  renderTable()
}

window.onload = async () => {
  const q = query(collection(db, 'signs'), orderBy('createdAt', 'desc'))
  const snap = await getDocs(q)
  allData = snap.docs.map(doc => doc.data())
  filteredData = [...allData]

  document.querySelectorAll('.range-btn').forEach(btn => {
    btn.onclick = () => applyFilter(btn.dataset.range)
  })

  document.querySelectorAll('th[data-sort]').forEach(th => {
    th.onclick = () => sortData(th.dataset.sort)
  })

  const searchInput = document.getElementById('search-input')
  searchInput.addEventListener('input', () => {
    const kw = searchInput.value.toLowerCase()
    filteredData = allData.filter(d => {
      return (
        (d.shortName || '').toLowerCase().includes(kw) ||
        (d.nickname || '').toLowerCase().includes(kw) ||
        (d.note || '').toLowerCase().includes(kw) ||
        (d.amount || '').toString().includes(kw)
      )
    })
    currentPage = 1
    renderTable()
  })

  renderTable()
}
