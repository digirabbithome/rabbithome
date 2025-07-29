
import { db } from '/js/firebase.js'
import {
  collection, getDocs, addDoc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'

let allResults = []
let currentPage = 1
const pageSize = 10
const resultList = document.getElementById('resultList')

// 搜尋功能
document.getElementById('searchKeyword').addEventListener('input', async (e) => {
  const keyword = e.target.value.trim().toLowerCase()
  const snapshot = await getDocs(collection(db, 'barcodes'))
  allResults = snapshot.docs.map(doc => {
    const d = doc.data()
    return {
      supplier: d.supplier || '',
      supplierName: d.supplierName || '',
      brand: d.brand || '',
      product: d.product || '',
      note: d.note || '',
      barcode: d.barcode || '',
      createdBy: d.createdBy || '',
      createdAt: d.createdAt?.toDate?.().toISOString().slice(0, 10) || ''
    }
  }).filter(d =>
    d.supplier.toLowerCase().includes(keyword) ||
    d.supplierName.toLowerCase().includes(keyword) ||
    d.brand.toLowerCase().includes(keyword) ||
    d.product.toLowerCase().includes(keyword) ||
    d.note.toLowerCase().includes(keyword) ||
    d.barcode.toLowerCase().includes(keyword) ||
    d.createdBy.toLowerCase().includes(keyword)
  ).sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  currentPage = 1
  renderPage()
})

function renderPage() {
  const start = (currentPage - 1) * pageSize
  const pageItems = allResults.slice(start, start + pageSize)

  resultList.innerHTML = `
    <table class="result-table">
      <thead><tr>
        <th>日期</th><th>供應商</th><th>廠牌</th><th>產品</th><th>備註</th><th>序號</th><th>填寫人</th>
      </tr></thead>
      <tbody>
        ${pageItems.map(r => `
          <tr>
            <td>${r.createdAt}</td>
            <td>${r.supplierName || r.supplier}</td>
            <td>${r.brand}</td>
            <td>${r.product}</td>
            <td>${r.note}</td>
            <td>${r.barcode}</td>
            <td>${r.createdBy}</td>
          </tr>`).join('')}
      </tbody>
    </table>
  `
}
