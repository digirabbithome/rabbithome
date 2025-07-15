import { db } from '/js/firebase.js'
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'

window.onload = async () => {
  const params = new URLSearchParams(window.location.search)
  const repairId = params.get('id') || ''
  document.getElementById('repairId').innerText = repairId

  const docRef = doc(db, 'repairs', repairId)
  const docSnap = await getDoc(docRef)

  if (!docSnap.exists()) return

  const d = docSnap.data()
  const created = d.createdAt?.toDate?.()
  const createdStr = created ? `${created.getFullYear()}/${created.getMonth() + 1}/${created.getDate()}` : ''
  document.getElementById('createdDate').innerText = createdStr
  document.getElementById('contactInfo').innerText = `${d.customer || ''} / ${d.phone || ''} / ${d.line || ''}`
  document.getElementById('address').innerText = d.address || ''
  document.getElementById('product').innerText = d.product || ''
  document.getElementById('description').innerText = d.statusDesc || ''
  document.getElementById('handler').innerText = d.nickname || ''

  // 顯示保固狀況
  const warrantyMap = {
    '內': '有保卡（保固內）',
    '過保': '有保卡（過保）',
    '無': '沒有保卡'
  }
  document.getElementById('warrantyStatus').innerText = warrantyMap[d.warranty] || ''
}
