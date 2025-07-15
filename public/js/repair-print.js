
import { db } from '/js/firebase.js'
import {
  collection, query, where, getDocs
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'

window.onload = async () => {
  const params = new URLSearchParams(window.location.search)
  const repairId = params.get('id') || ''
  if (!repairId) return

  const q = query(collection(db, 'repairs'), where('repairId', '==', repairId))
  const snapshot = await getDocs(q)
  if (snapshot.empty) {
    document.body.innerHTML = `❌ 查無維修單：${repairId}`
    return
  }

  const d = snapshot.docs[0].data()

  document.title = `維修單 ${repairId}`
  document.getElementById('repairId').innerText = repairId
  document.getElementById('company').innerText = d.senderCompany || ''
  document.getElementById('warranty').innerText = d.warranty || ''
  document.getElementById('product').innerText = d.product || ''
  document.getElementById('description').innerText = d.description || ''

  const line = d.line ? `（LINE: ${d.line}）` : ''
  const customerText = [
    `${d.customer || ''} ${line}`,
    d.phone || '',
    d.address || ''
  ].filter(x => x).join('<br>')
  document.getElementById('customerInfo').innerHTML = customerText
}
