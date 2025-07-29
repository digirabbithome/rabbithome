
// barcode.js
import { db } from '/js/firebase.js'
import {
  collection, addDoc, serverTimestamp, getDocs
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'

const nickname = localStorage.getItem('nickname') || '未知使用者'

document.getElementById('submitBtn').addEventListener('click', async () => {
  const supplier = document.getElementById('supplierInput').dataset.value || ''
  const brand = document.getElementById('brand').value.trim()
  const product = document.getElementById('product').value.trim()
  const note = document.getElementById('note').value.trim()
  const rawBarcodes = document.getElementById('barcodes').value.trim()

  if (!supplier) return alert('請選擇供應商')
  if (!rawBarcodes) return alert('請輸入條碼')

  const barcodeList = rawBarcodes.split('\n').map(x => x.trim()).filter(x => x)

  for (const barcode of barcodeList) {
    const supplierName = supplierInput.value.trim();
    await addDoc(collection(db, 'barcodes'), {
      barcode,
      supplier,
      brand,
      product,
      note,
      createdBy: nickname,
      supplierName,
      createdAt: serverTimestamp()
    })
  }

  alert(`成功登記 ${barcodeList.length} 筆條碼`)
  document.getElementById('barcodes').value = ''
})

// 🔍 popmenu 搜尋供應商
let suppliers = []

async function loadSuppliers() {
  const snapshot = await getDocs(collection(db, 'suppliers'))
  suppliers = snapshot.docs.map(doc => {
    const d = doc.data()
    return {
      code: d.code || '',
      nameShort: d.shortName || d.name || '（無名稱）'
    }
  })
}
loadSuppliers()

const supplierInput = document.getElementById('supplierInput')
const supplierResults = document.getElementById('supplierResults')

supplierInput.addEventListener('input', () => {
  const keyword = supplierInput.value.trim().toLowerCase()
  const matched = suppliers.filter(s =>
    s.code.toLowerCase().includes(keyword) ||
    s.nameShort.toLowerCase().includes(keyword)
  ).slice(0, 10)

  supplierResults.innerHTML = matched.map(s =>
    `<div class="result" data-code="${s.code}">${s.code} - ${s.nameShort}</div>`
  ).join('')
})

supplierResults.addEventListener('click', e => {
  e.preventDefault()
  e.stopPropagation()
  if (e.target.classList.contains('result')) {
    const code = e.target.dataset.code
    supplierInput.value = e.target.textContent
    supplierInput.dataset.value = code
    supplierResults.innerHTML = ''
  }
})

// 🔍 查詢功能
const searchInput = document.getElementById('searchInput')
const resultList = document.getElementById('resultList')
const pageInfo = document.getElementById('pageInfo')
const prevPageBtn = document.getElementById('prevPage')
const nextPageBtn = document.getElementById('nextPage')

let allResults = []
let currentPage = 1
const pageSize = 100

searchInput.addEventListener('input', async () => {
  const today = new Date().toISOString().slice(0, 10);
  const keyword = searchInput.value.trim().toLowerCase()
  if (!keyword) {
    allResults = allResults.filter(d => d.createdAt === today);

  }

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
    d.brand.toLowerCase().includes(keyword) ||
    d.product.toLowerCase().includes(keyword) ||
    d.note.toLowerCase().includes(keyword) ||
    d.barcode.toLowerCase().includes(keyword) ||
    d.createdBy.toLowerCase().includes(keyword) ||
    d.supplierName.toLowerCase().includes(keyword)
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

  const totalPages = Math.ceil(allResults.length / pageSize)
  pageInfo.textContent = `第 ${currentPage} 頁／共 ${totalPages} 頁`

  prevPageBtn.disabled = currentPage <= 1
  nextPageBtn.disabled = currentPage >= totalPages
}

prevPageBtn.addEventListener('click', () => {
  if (currentPage > 1) {
    currentPage--
    renderPage()
  }
})

nextPageBtn.addEventListener('click', () => {
  const totalPages = Math.ceil(allResults.length / pageSize)
  if (currentPage < totalPages) {
    currentPage++
    renderPage()
  }
})
