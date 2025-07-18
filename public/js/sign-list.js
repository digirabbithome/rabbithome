
import { db } from '/js/firebase.js'
import { collection, query, getDocs, orderBy } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'

let signData = []
let currentPage = 1
const rowsPerPage = 20

function renderTable(data) {
  const tbody = document.getElementById("sign-body")
  const start = (currentPage - 1) * rowsPerPage
  const pageData = data.slice(start, start + rowsPerPage)

  tbody.innerHTML = pageData.map(d => `
    <tr>
      <td>${new Date(d.createdAt?.seconds * 1000).toLocaleDateString()}</td>
      <td>${d.type2 || ""}</td>
      <td>${d.note || ""}</td>
      <td>${d.amount || ""}</td>
      <td>${d.nickname || ""}</td>
      <td><img src="${d.signatureUrl}" class="thumb" /></td>
    </tr>
  `).join("")

  renderPagination(data.length)
}

function renderPagination(totalRows) {
  const pageCount = Math.ceil(totalRows / rowsPerPage)
  const container = document.getElementById("pagination")
  if (!container) return
  container.innerHTML = ""

  for (let i = 1; i <= pageCount; i++) {
    const btn = document.createElement("button")
    btn.textContent = i
    btn.disabled = i === currentPage
    btn.onclick = () => {
      currentPage = i
      applySearch()
    }
    container.appendChild(btn)
  }
}

function applySearch() {
  const keyword = document.getElementById("search-input")?.value.trim().toLowerCase()
  if (!keyword) return renderTable(signData)

  const filtered = signData.filter(d => {
    const fields = [d.type2, d.note, d.amount, d.nickname]
    return fields.some(f => (f || "").toString().toLowerCase().includes(keyword))
  })
  renderTable(filtered)
}

window.onload = async () => {
  const snapshot = await getDocs(query(collection(db, "signs"), orderBy("createdAt", "desc")))
  signData = snapshot.docs.map(doc => doc.data())
  renderTable(signData)

  document.getElementById("search-input")?.addEventListener("input", applySearch)

  document.querySelectorAll(".range-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const range = btn.dataset.range
      const now = new Date()
      let start = new Date()

      if (range === "today") {
        start.setHours(0, 0, 0, 0)
      } else if (range === "week") {
        start.setDate(now.getDate() - 6)
        start.setHours(0, 0, 0, 0)
      } else if (range === "month") {
        start.setMonth(now.getMonth() - 1)
        start.setHours(0, 0, 0, 0)
      }

      const filtered = signData.filter(d => {
        const ts = d.createdAt?.seconds * 1000
        return ts >= start.getTime()
      })
      currentPage = 1
      renderTable(filtered)
    })
  })
}
