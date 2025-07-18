import { db } from '/js/firebase.js'
import { collection, query, getDocs, orderBy } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'

let signData = []

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
}



let currentPage = 1;
const itemsPerPage = 20;






let currentPage = 1;
const itemsPerPage = 20;




