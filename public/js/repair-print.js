
import { db } from '/js/firebase.js'
import {
  collection, query, where, getDocs
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'

window.onload = async () => {
  const nickname = localStorage.getItem('nickname') || '（未登入）'
  document.getElementById('handler').innerText = nickname

  const params = new URLSearchParams(window.location.search)
  const repairId = params.get('id') || ''
  if (!repairId) return

  const q = query(collection(db, 'repairs'), where('repairId', '==', repairId))
  const snapshot = await getDocs(q)
  if (snapshot.empty) return

  const d = snapshot.docs[0].data()

  document.title = `維修單 ${repairId}`
  document.getElementById('repairId').innerText = repairId
  document.getElementById('warranty').innerText = d.warranty || ''
  document.getElementById('product').innerText = d.product || ''
  document.getElementById('description').innerText = d.description || ''
  document.getElementById('createdAt').innerText = d.createdAt?.toDate?.().toLocaleDateString?.() || ''

  const name = d.customer || ''
  const phone = d.phone || ''
  const line = d.line ? `LINE: @${d.line}` : ''
  const address = d.address || ''
  const row1 = [name, line, phone].filter(x => x).join('　')
  const row2 = address ? `地址：${address}` : ''
  document.getElementById('contactInfo1').innerText = row1
  document.getElementById('contactInfo2').innerText = row2
}
