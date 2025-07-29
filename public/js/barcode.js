import { db } from '/js/firebase.js'
import {
  collection, getDocs, query, orderBy, addDoc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'

let barcodeData = []
let suppliers = []

async function loadSuppliers() {
  const snapshot = await getDocs(collection(db, 'suppliers'))
  suppliers = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }))
}

async function loadBarcodes() {
  const snapshot = await getDocs(query(collection(db, 'barcodes'), orderBy('createdAt', 'desc')))
  barcodeData = snapshot.docs.map(doc => doc.data())
  renderResults()
}

function renderResults() {
  const keyword = document.getElementById('searchInput').value.trim().toLowerCase()
  const resultList = document.getElementById('resultList')
  resultList.innerHTML = ''

  const filtered = barcodeData.filter(d => d && (
    (d.serial || '').toLowerCase().includes(keyword) ||
    (d.supplierName || '').toLowerCase().includes(keyword) ||
    (d.brand || '').toLowerCase().includes(keyword) ||
    (d.product || '').toLowerCase().includes(keyword) ||
    (d.note || '').toLowerCase().includes(keyword) ||
    (d.nickname || '').toLowerCase().includes(keyword)
  ))

  filtered.forEach(d => {
    const div = document.createElement('div')
    div.className = 'record'
    div.innerHTML = `<strong>${d.serial || ''}</strong>｜${d.supplierName || ''}｜${d.brand || ''}｜${d.product || ''}｜${d.note || ''}｜${d.nickname || ''}｜${d.createdAt?.toDate().toLocaleString() || ''}`
    resultList.appendChild(div)
  })
}

window.onload = async () => {
  await loadSuppliers()
  await loadBarcodes()

  document.getElementById('searchInput').addEventListener('input', renderResults)

  document.getElementById('submitBtn').addEventListener('click', async () => {
    const barcodes = document.getElementById('barcodes').value.trim().split('\n')
    const supplierInput = document.getElementById('supplierInput').value.trim()
    const brand = document.getElementById('brand').value.trim()
    const product = document.getElementById('product').value.trim()
    const note = document.getElementById('note').value.trim()
    const nickname = localStorage.getItem('nickname') || '未知使用者'

    const supplierName = supplierInput
    if (!supplierName || !brand || !product || barcodes.length === 0) {
      alert('請填寫所有欄位')
      return
    }

    for (let serial of barcodes) {
      serial = serial.trim()
      if (serial) {
        await addDoc(collection(db, 'barcodes'), {
          serial,
          supplierName,
          brand,
          product,
          note,
          nickname,
          createdAt: serverTimestamp()
        })
      }
    }

    alert('已成功登記')
    document.getElementById('barcodes').value = ''
    await loadBarcodes()
  })
}
