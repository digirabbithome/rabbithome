
import { db } from '/js/firebase.js'
import {
  collection, query, where, getDocs, addDoc, orderBy, serverTimestamp
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
    const match = [p.contact, p.product, p.note].some(v => (v || '').toLowerCase().includes(kw))
    if (!match) return
    const note = (p.note || '—') + (p.paid ? `（${p.paid}）` : '')
    const div = document.createElement('div')
    div.className = 'pickup-card'
    div.innerHTML = `
      <div class="text-sm"><strong>#${p.serial || '—'}</strong> ${p.contact || '未填寫'}</div>
      <div class="text-sm">商品：${p.product}</div>
      <div class="text-sm">備註：${note}</div>
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

  const today = new Date()
  const mmdd = `${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`

  const q = query(collection(db, 'pickups'), where('serial', '>=', mmdd), where('serial', '<', mmdd + '999'))
  const snapshot = await getDocs(q)
  const serial = mmdd + (snapshot.size + 1).toString().padStart(3, '0')

  await addDoc(collection(db, 'pickups'), {
    contact, product, note, paid,
    serial,
    createdAt: serverTimestamp(),
    createdBy: nickname
  })

  document.getElementById('contact').value = ''
  document.getElementById('product').value = ''
  document.getElementById('note').value = ''

  document.getElementById('form-area').style.display = 'none'
  document.getElementById('list-area').style.display = 'block'

  await fetchData()
  renderList()
}
