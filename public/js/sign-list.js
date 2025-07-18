
import { db } from '/js/firebase.js'
import {
  collection, query, getDocs, orderBy
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'

let signData = []
let currentSortField = 'createdAt'
let currentSortDirection = 'desc'

function renderTable(data) {
  const tbody = document.getElementById("sign-body")
  tbody.innerHTML = data.map(d => `
    <tr>
      <td>${new Date(d.createdAt?.seconds * 1000).toLocaleDateString()}</td>
      <td>${d.type2 || ""}</td>
      <td>${d.note || ""}</td>
      <td>${d.amount || ""}</td>
      <td>${d.nickname || ""}</td>
      <td><img src="${d.signatureUrl}" class="thumb" /></td>
    </tr>
  `).join("")
}

function applySearchAndRender() {
  const keyword = document.getElementById("search-input")?.value.trim().toLowerCase()
  const monthFilter = document.getElementById("month-select")?.value

  let filtered = [...signData]

  // 搜尋欄位
  if (keyword) {
    filtered = filtered.filter(d => {
      const fields = [d.type2, d.note, d.amount, d.nickname]
      return fields.some(f => (f || "").toString().toLowerCase().includes(keyword))
    })
  }

  // 月份篩選
  if (monthFilter && monthFilter !== 'all') {
    filtered = filtered.filter(d => {
      const date = new Date(d.createdAt?.seconds * 1000)
      const m = (date.getMonth() + 1).toString().padStart(2, '0')
      const y = date.getFullYear().toString()
      return `${y}-${m}` === monthFilter
    })
  }

  // 排序
  filtered.sort((a, b) => {
    const valA = a[currentSortField]
    const valB = b[currentSortField]
    if (currentSortDirection === 'asc') {
      return valA > valB ? 1 : -1
    } else {
      return valA < valB ? 1 : -1
    }
  })

  renderTable(filtered)
}

function initMonthSelector() {
  const select = document.getElementById("month-select")
  const months = new Set()
  signData.forEach(d => {
    const date = new Date(d.createdAt?.seconds * 1000)
    const m = (date.getMonth() + 1).toString().padStart(2, '0')
    const y = date.getFullYear().toString()
    months.add(`${y}-${m}`)
  })

  const sortedMonths = Array.from(months).sort().reverse()
  select.innerHTML = `<option value="all">全部月份</option>` +
    sortedMonths.map(m => `<option value="${m}">${m}</option>`).join("")

  select.addEventListener("change", applySearchAndRender)
}

window.onload = async () => {
  const snapshot = await getDocs(query(collection(db, "signs"), orderBy("createdAt", "desc")))
  signData = snapshot.docs.map(doc => doc.data())

  initMonthSelector()
  applySearchAndRender()

  document.getElementById("search-input")?.addEventListener("input", applySearchAndRender)

  // 排序邏輯
  document.querySelectorAll("th[data-sort]").forEach(th => {
    th.addEventListener("click", () => {
      const field = th.dataset.sort
      if (currentSortField === field) {
        currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc'
      } else {
        currentSortField = field
        currentSortDirection = 'asc'
      }
      applySearchAndRender()
    })
  })
}
