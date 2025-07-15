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

  const created = d.createdAt?.toDate?.()
  const dateStr = created ? `${created.getFullYear()}/${created.getMonth()+1}/${created.getDate()}` : ''
  document.getElementById('createdAt').innerText = dateStr

  const line = d.line ? `（LINE: ${d.line}）` : ''
  const customer = [d.customer, d.phone, line].filter(Boolean).join('　')
  const address = d.address ? `<div>${d.address}</div>` : ''
  document.getElementById('customerInfo').innerHTML = `<div>${customer}</div>${address}`
}
