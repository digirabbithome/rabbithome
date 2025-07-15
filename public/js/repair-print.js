
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

  const line = d.line ? `（LINE: ${d.line}）` : ''
  const customerText = [
    `<span class='label'>姓名：</span>${d.customer || ''} ${line}<br>`,
    `<span class='label'>電話：</span>${d.phone || ''}<br>`,
    `<span class='label'>地址：</span>${d.address || ''}`
  ].filter(x => x).join('')
  document.getElementById('customerInfo').innerHTML = customerText
}
