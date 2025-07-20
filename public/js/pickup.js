
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

  document.addEventListener('click', e => {
    if (e.target.classList.contains('print-link')) {
      const id = e.target.dataset.id
      const data = pickupList.find(p => p.id === id)
      if (!data) return

      const area = document.getElementById('print-area')
      area.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <img src="img/logo-black.png" style="height: 48px;" />
          <div style="font-size: 40px; font-weight: bold;">${data.serial}</div>
        </div>
        <hr style="margin: 20px 0; border-top: 2px solid #000;" />
        <h2 style="text-align: center; margin-bottom: 24px;">數位小兔取貨單</h2>
        <p><strong>取貨人：</strong>${data.contact}</p>
        <p><strong>商品：</strong>${data.product}</p>
        <p><strong>備註：</strong>${data.note || '—'}（${data.paid}）</p>
        <p><strong>服務業務：</strong>${data.createdBy || ''}</p>
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

async function addPickup() {
  const contact = document.getElementById('contact').value.trim()
  const product = document.getElementById('product').value.trim()
  const note = document.getElementById('note').value.trim()
  const paid = document.getElementById('paid').value
  const nickname = localStorage.getItem('nickname') || '未登入'
  const serial = "07201234"

  await addDoc(collection(db, 'pickups'), {
    contact, product, note, paid,
    createdBy: nickname,
    createdAt: new Date(),
    pinStatus: 0,
    serial
  })

  await fetchData()
  renderList()
}
