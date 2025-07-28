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
    await addDoc(collection(db, 'barcodes'), {
      barcode,
      supplier,
      brand,
      product,
      note,
      createdBy: nickname,
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
