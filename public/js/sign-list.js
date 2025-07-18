
import { db } from '/js/firebase.js'
import {
  collection, getDocs, query, orderBy
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'

let allData = []
let currentPage = 1
let pageSize = 50
let currentSortField = 'createdAt'
let currentSortDirection = 'desc'

async function fetchData() {
  const q = query(collection(db, 'signs'))
  const snapshot = await getDocs(q)
  allData = snapshot.docs.map(doc => doc.data())
  renderTable()
}

function sortData() {
  allData.sort((a, b) => {
    let aVal = a[currentSortField]
    let bVal = b[currentSortField]

    if (aVal?.toDate) aVal = aVal.toDate()
    if (bVal?.toDate) bVal = bVal.toDate()

    if (currentSortDirection === 'asc') {
      return aVal > bVal ? 1 : -1
    } else {
      return aVal < bVal ? 1 : -1
    }
  })
}

function renderTable() {
  sortData()

  const start = (currentPage - 1) * pageSize
  const end = start + pageSize
  const pageData = allData.slice(start, end)

  const tbody = document.getElementById('sign-list')
  tbody.innerHTML = ''
  pageData.forEach(d => {
    const row = document.createElement('tr')
    row.innerHTML = `
      <td>${d.createdAt?.toDate().toLocaleDateString() || ''}</td>
      <td>${d.type2 || ''}</td>
      <td>${d.note || ''}</td>
      <td>${d.amount || ''}</td>
      <td>${d.nickname || ''}</td>
      <td><img src="${d.signatureUrl || ''}" width="60"/></td>
    `
    tbody.appendChild(row)
  })

  renderPagination()
}

function renderPagination() {
  const totalPages = Math.ceil(allData.length / pageSize)
  const pager = document.getElementById('pager')
  pager.innerHTML = ''

  if (totalPages <= 1) return

  for (let i = 1; i <= totalPages; i++) {
    const btn = document.createElement('button')
    btn.textContent = i
    btn.className = (i === currentPage ? 'active' : '')
    btn.addEventListener('click', () => {
      currentPage = i
      renderTable()
    })
    pager.appendChild(btn)
  }
}

function setupSorting() {
  document.querySelectorAll('th.sortable').forEach(th => {
    th.addEventListener('click', () => {
      const field = th.dataset.field
      if (field === currentSortField) {
        currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc'
      } else {
        currentSortField = field
        currentSortDirection = 'asc'
      }
      renderTable()
    })
  })
}

window.onload = () => {
  fetchData()
  setupSorting()
}
