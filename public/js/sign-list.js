
import { db } from '/js/firebase.js'
import {
  collection, getDocs, query, orderBy
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'

let signData = []
let currentPage = 1
const itemsPerPage = 5
let sortField = 'createdAt'
let sortDirection = 'desc'
let filteredData = []

function sortData(data) {
  return data.sort((a, b) => {
    let aVal = a[sortField]
    let bVal = b[sortField]

    if (sortField === 'createdAt') {
      aVal = aVal?.toDate?.() || new Date(0)
      bVal = bVal?.toDate?.() || new Date(0)
    }

    if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1
    if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1
    return 0
  })
}

function renderTable() {
  const tbody = document.getElementById('sign-body')
  if (!tbody) return
  const start = (currentPage - 1) * itemsPerPage
  const end = start + itemsPerPage
  const pageData = sortData(filteredData).slice(start, end)

  tbody.innerHTML = ''
  pageData.forEach(d => {
    const tr = document.createElement('tr')
    tr.innerHTML = `
      <td>{new Date(d.createdAt?.seconds * 1000).toLocaleDateString()}</td>
      <td>{d.shortName || ''}</td>
      <td>{d.note || ''}</td>
      <td>{d.amount || ''}</td>
      <td>{d.nickname || ''}</td>
      <td><img src="{d.signatureUrl}" class="thumbnail" /></td>
    `
    tbody.appendChild(tr)
  })

  renderPagination(filteredData.length)
}

function renderPagination(totalItems) {
  const pagination = document.getElementById('pagination')
  if (!pagination) return

  const totalPages = Math.ceil(totalItems / itemsPerPage)
  pagination.innerHTML = ''
  if (totalPages <= 1) return

  const prevBtn = document.createElement('button')
  prevBtn.textContent = '上一頁'
  prevBtn.disabled = currentPage === 1
  prevBtn.onclick = () => { currentPage--; renderTable() }
  pagination.appendChild(prevBtn)

  const nextBtn = document.createElement('button')
  nextBtn.textContent = '下一頁'
  nextBtn.disabled = currentPage === totalPages
  nextBtn.onclick = () => { currentPage++; renderTable() }
  pagination.appendChild(nextBtn)
}

function applySearchAndFilter() {
  const keyword = document.getElementById('search-input')?.value.trim().toLowerCase()
  filteredData = signData.filter(d => {
    const date = d.createdAt?.toDate?.() || new Date(0)
    const text = [d.shortName, d.nickname, d.note, d.amount].join(' ').toLowerCase()
    const matchKeyword = !keyword || text.includes(keyword)
    const matchDate = !window.activeRange || date >= window.activeRange.start && date <= window.activeRange.end
    return matchKeyword && matchDate
  })
  currentPage = 1
  renderTable()
}

function setDateRange(rangeType) {
  const now = new Date()
  let start = new Date()
  let end = new Date()

  if (rangeType === 'today') {
    start.setHours(0, 0, 0, 0)
    end.setHours(23, 59, 59, 999)
  } else if (rangeType === 'week') {
    const day = now.getDay() || 7
    start.setDate(now.getDate() - day + 1)
    start.setHours(0, 0, 0, 0)
    end.setHours(23, 59, 59, 999)
  } else if (rangeType === 'month') {
    start = new Date(now.getFullYear(), now.getMonth(), 1)
    end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
  } else {
    window.activeRange = null
    applySearchAndFilter()
    return
  }

  window.activeRange = { start, end }
  applySearchAndFilter()
}

window.onload = async () => {
  const q = query(collection(db, 'signs'), orderBy('createdAt', 'desc'))
  const snapshot = await getDocs(q)
  signData = snapshot.docs.map(doc => doc.data())
  filteredData = [...signData]
  renderTable()

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

  document.getElementById('search-input')?.addEventListener('input', applySearchAndFilter)
  document.querySelectorAll('.range-btn')?.forEach(btn => {
    btn.addEventListener('click', () => setDateRange(btn.dataset.range))
  })
}
