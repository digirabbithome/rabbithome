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

  document.addEventListener('click', e => {
    if (e.target.classList.contains('print-link')) {
      const id = e.target.dataset.id
      const data = pickupList.find(p => p.id === id)
      if (!data) return

      const area = document.getElementById('print-area')
      area.innerHTML = `
        <h2>📦 數位小兔取貨單</h2>
        <p><strong>編號：</strong> ${data.serial}</p>
        <p><strong>聯絡人：</strong> ${data.contact}</p>
        <p><strong>商品內容：</strong><br>${data.product}</p>
        <p><strong>備註：</strong><br>${data.note || '—'}</p>
        <p><strong>付款狀態：</strong> ${data.paid}</p>
        <p><strong>填單人：</strong> ${data.createdBy || ''}</p>
      `
      document.getElementById('list-area').style.display = 'none'
      area.style.display = 'block'
      window.print()
      area.style.display = 'none'
      document.getElementById('list-area').style.display = 'block'
    }
  })
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
    const match = [p.serial, p.contact, p.product, p.note].some(v => (v || '').toLowerCase().includes(kw))
    if (!match) return

    let bgColor = '#fff9b1'
    if (p.paid === '已付訂金') bgColor = '#d0f0ff'
    if (p.paid === '已付全額') bgColor = '#d9f7c5'

    const div = document.createElement('div')
    div.className = 'pickup-card'
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
  const mmdd = (now.getMonth() + 1).toString().padStart(2, '0') +
               now.getDate().toString().padStart(2, '0')

  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const end = new Date(start)
  end.setDate(end.getDate() + 1)

  const q = query(
    collection(db, 'pickups'),
    where('createdAt', '>=', start),
    where('createdAt', '<', end)
  )
  const snapshot = await getDocs(q)
  const count = snapshot.size + 1
  const num = count.toString().padStart(3, '0')
  return mmdd + num
}
