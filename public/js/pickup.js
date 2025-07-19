
import { db } from '/js/firebase.js'
import {
  collection, addDoc, getDocs, query, orderBy, serverTimestamp, where, doc, updateDoc
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

  const priority = { '未付款': 1, '已付訂金': 2, '已付全額': 3 }

  pickupList
    .filter(p => !('status' in p) || p.status === 0 || p.status === 1)
    .sort((a, b) => {
      const p1 = priority[a.paid] || 99
      const p2 = priority[b.paid] || 99
      if (p1 !== p2) return p1 - p2
      const t1 = a.createdAt?.toDate?.() || new Date(0)
      const t2 = b.createdAt?.toDate?.() || new Date(0)
      return t2 - t1
    })
    .forEach(p => {
      const match = [p.serial, p.contact, p.product, p.note].some(v => (v || '').toLowerCase().includes(kw))
      if (!match) return

      let bgColor = '#fff9b1'
      if (p.paid === '已付訂金') bgColor = '#d0f0ff'
      if (p.paid === '已付全額') bgColor = '#d9f7c5'

      const div = document.createElement('div')
      div.className = 'pickup-card'
      div.style.backgroundColor = bgColor

      const status = p.status ?? 0
      let stickerSrc = ''
      if (status === 1) stickerSrc = '/img/sticker_1.png'
      if (status === 0) stickerSrc = '/img/sticker_2.png'

      const sticker = status < 2 ? `<img class="sticker" src="${stickerSrc}" />` : ''

      div.innerHTML = `
        <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #999; padding-bottom: 2px; margin-bottom: 4px; position: relative;">
          <strong>${p.serial || '—'}</strong>
          <span>${p.contact || '未填寫'}</span>
          ${sticker}
        </div>
        <div>${p.product}</div>
        <small>${p.note || '—'}（${p.paid}）</small>
      `

      const stickerEl = div.querySelector('.sticker')
      if (stickerEl) {
        stickerEl.addEventListener('click', async () => {
          const newStatus = ((status + 1) % 3)
          const updateData = { status: newStatus }
          if (newStatus === 2) {
            updateData.completedAt = serverTimestamp()
            updateData.completedBy = localStorage.getItem('nickname') || '未登入使用者'
          }
          await updateDoc(doc(db, 'pickups', p.id), updateData)
          await fetchData()
          renderList()
        })
      }

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
    serial,
    status: 0
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
