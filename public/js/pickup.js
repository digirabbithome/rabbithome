// pickup.js
import { db } from '/js/firebase.js'
import {
  collection, addDoc, getDocs, query, orderBy, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'

let pickupList = []

window.onload = async () => {
  document.getElementById('addBtn').addEventListener('click', addPickup)
  document.getElementById('search').addEventListener('input', renderList)
  await fetchData()
  renderList()
}

async function fetchData() {
  const q = query(collection(db, 'pickups'), orderBy('createdAt', 'desc'))
  const snapshot = await getDocs(q)
  pickupList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
}

function getAgeClass(date) {
  const days = (Date.now() - date.getTime()) / 86400000
  if (days >= 21) return 'age-3w'
  if (days >= 14) return 'age-2w'
  if (days >= 7) return 'age-1w'
  return ''
}

function renderList() {
  const kw = document.getElementById('search').value.trim().toLowerCase()
  const list = document.getElementById('pickup-list')
  list.innerHTML = ''

  pickupList.forEach(p => {
    const created = p.createdAt?.toDate?.()
    const className = created ? getAgeClass(created) : ''
    const match = [p.contact, p.product, p.note].some(v =>
      (v || '').toLowerCase().includes(kw)
    )
    if (!match) return

    const div = document.createElement('div')
    div.className = `record-item ${className}`
    div.innerHTML = `
      <div class="top-row">
        <div>${p.contact || '無聯絡資訊'}</div>
        <div class="text-sm">${p.createdBy || '匿名'}・${created ? created.toLocaleDateString() : ''}</div>
      </div>
      <div class="text-sm">${p.product || ''}</div>
      <div class="text-sm">付款：${p.paid || '未填寫'}</div>
      <div class="text-sm">備註：${p.note || ''}</div>
      <div class="action-buttons">
        <button onclick="window.print()">列印</button>
      </div>
    `
    list.appendChild(div)
  })
}

async function addPickup() {
  const contact = document.getElementById('contact').value.trim()
  const product = document.getElementById('product').value.trim()
  const note = document.getElementById('note').value.trim()
  const paid = document.getElementById('paid').value
  const nickname = localStorage.getItem('nickname') || '匿名'

  if (!contact && !product) return alert('請至少填寫聯絡資訊或商品內容')

  await addDoc(collection(db, 'pickups'), {
    contact, product, note, paid,
    createdAt: serverTimestamp(),
    createdBy: nickname
  })

  document.getElementById('contact').value = ''
  document.getElementById('product').value = ''
  document.getElementById('note').value = ''

  await fetchData()
  renderList()
}
