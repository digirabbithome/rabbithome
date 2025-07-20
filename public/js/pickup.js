
import { db } from '/js/firebase.js'
import {
  collection, addDoc, getDocs, query, orderBy, serverTimestamp, where
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

  const priority = {
    '未付款': 1,
    '已付訂金': 2,
    '已付全額': 3
  }

  pickupList.sort((a, b) => {
    const p1 = priority[a.paid] || 99
    const p2 = priority[b.paid] || 99
    if (p1 !== p2) return p1 - p2

    const t1 = a.createdAt?.toDate?.() || new Date(0)
    const t2 = b.createdAt?.toDate?.() || new Date(0)
    return t2 - t1
  })

  pickupList.forEach(p => {
    if (p.pinStatus === 1) return

    const match = [p.serial, p.contact, p.product, p.note].some(v => (v || '').toLowerCase().includes(kw))
    if (!match) return

    let bgColor = '#fff9b1'
    if (p.paid === '已付訂金') bgColor = '#d0f0ff'
    if (p.paid === '已付全額') bgColor = '#d9f7c5'

    const div = document.createElement('div')
    div.className = 'pickup-card'
    const now = new Date()
    const createdAt = p.createdAt?.toDate?.() || new Date(0)
    const dayDiff = (now - createdAt) / (1000 * 60 * 60 * 24)
    if (dayDiff > 14) bgColor = '#ffb1b1'
    div.style.backgroundColor = bgColor
    div.innerHTML = `
      <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #999; padding-bottom: 2px; margin-bottom: 4px;">
        <strong>${p.serial || '—'}</strong>
        <span class="print-link" data-id="${p.id}">${p.contact || '未填寫'}</span>
      </div>
      <div>商品：${p.product}</div>
      <small>${p.note || '—'}（${p.paid}）(${p.createdBy || ''})</small>
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

  const serial = await generateSerial()

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

async function generateSerial() {
  const now = new Date()
  const mm = (now.getMonth() + 1).toString().padStart(2, '0')
  const dd = now.getDate().toString().padStart(2, '0')
  const hh = now.getHours().toString().padStart(2, '0')
  const mi = now.getMinutes().toString().padStart(2, '0')
  return mm + dd + hh + mi
}
