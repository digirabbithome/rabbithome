import { db } from '/js/firebase.js'
import {
  collection, query, where, getDocs
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'

window.onload = async () => {
  const nickname = localStorage.getItem('nickname') || '（未登入）'
  const params = new URLSearchParams(window.location.search)
  const repairId = params.get('id') || ''
  if (!repairId) return

  const q = query(collection(db, 'repairs'), where('repairId', '==', repairId))
  const snapshot = await getDocs(q)
  if (snapshot.empty) return

  const d = snapshot.docs[0].data()
  document.title = `維修單 ${repairId}`
  document.getElementById('repairId').innerText = repairId
  document.getElementById('handler').innerText = nickname

  const created = d.createdAt?.toDate?.()
  const dateStr = created ? `${created.getFullYear()}/${created.getMonth()+1}/${created.getDate()}` : ''
  document.getElementById('createdAt').innerText = dateStr

  let warrantyStr = d.warranty || ''
  if (warrantyStr === '有保卡（保固內）') warrantyStr = '有保卡（保固內）'
  else if (warrantyStr === '有保卡（過保）') warrantyStr = '有保卡（過保）'
  else if (warrantyStr === '沒有保卡') warrantyStr = '沒有保卡'
  document.getElementById('warranty').innerText = warrantyStr

  const line = d.line ? `（LINE: ${d.line}）` : ''
  const contact = [d.customer || '', d.phone || '', line].filter(x => x).join(' / ')
  document.getElementById('contactInfo').innerText = contact
  document.getElementById('addressLine').innerText = d.address || ''

  document.getElementById('product').innerText = d.product || ''
  document.getElementById('description').innerText = d.description || ''
}