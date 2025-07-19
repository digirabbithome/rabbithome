
import { db } from '/js/firebase.js'
import {
  collection, addDoc, getDocs, query, orderBy, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'

let pickupList = []

window.onload = async () => {
  document.getElementById('addBtn').addEventListener('click', addPickup)
  document.getElementById('search').addEventListener('input', renderList)
  document.getElementById('showFormBtn').addEventListener('click', () => {
    document.getElementById('form-area').style.display = 'block'
    document.getElementById('list-area').style.display = 'none'
  })
  document.getElementById('cancelFormBtn').addEventListener('click', () => {
    document.getElementById('form-area').style.display = 'none'
    document.getElementById('list-area').style.display = 'block'
  })
  await fetchData()
  renderList()
}

async function fetchData() {
  const q = query(collection(db, 'pickups'), orderBy('createdAt', 'desc'))
  const snapshot = await getDocs(q)
  pickupList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
}

function renderList() {
  const kw = document.getElementById('search').value.trim().toLowerCase()
  const list = document.getElementById('pickup-list')
  list.innerHTML = ''

  pickupList.forEach(p => {
    const match = [p.contact, p.product, p.note, p.serial].some(v => (v || '').toLowerCase().includes(kw))
    if (!match) return
    const div = document.createElement('div')
    div.className = 'pickup-card'
    div.innerHTML = `
      <strong>${p.serial || '—'}</strong>
      <div>${p.contact || '未填寫'}</div>
      <div>付款狀態：${p.paid}</div>
      <div>商品：${p.product}</div>
      <small>備註：${p.note || '—'}</small>
    `
    list.appendChild(div)
  })
}

async function addPickup() {
  const contact = document.getElementById('contact').value.trim()
  const product = document.getElementById('product').value.trim()
  const note = document.getElementById('note').value.trim()
  const paid = document.getElementById('paid').value
  const nickname = localStorage.getItem('nickname') || '未登入使用者'

  if (!contact && !product) return alert('⚠️ 請至少填寫聯絡資訊或商品內容')

  const now = new Date()
  const serial =
    (now.getMonth() + 1).toString().padStart(2, '0') +
    now.getDate().toString().padStart(2, '0') +
    now.getHours().toString().padStart(2, '0') +
    now.getMinutes().toString().padStart(2, '0')

  await addDoc(collection(db, 'pickups'), {
    contact, product, note, paid,
    createdAt: serverTimestamp(),
    createdBy: nickname,
    serial
  })

  document.getElementById('contact').value = ''
  document.getElementById('product').value = ''
  document.getElementById('note').value = ''

  document.getElementById('form-area').style.display = 'none'
  document.getElementById('list-area').style.display = 'block'

  await fetchData()
  renderList()
}
