
import { db } from '/js/firebase.js'
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'

window.onload = async () => {
  const params = new URLSearchParams(window.location.search)
  const id = params.get('id')
  if (!id) return

  const docRef = doc(db, 'repairs', id)
  const snap = await getDoc(docRef)
  if (!snap.exists()) return

  const d = snap.data()

  document.getElementById('repairId')?.innerText = d.repairId || ''
  document.getElementById('createdAt')?.innerText = d.createdAt?.toDate().toLocaleDateString('zh-Hant') || ''
  document.getElementById('handler')?.innerText = d.nickname || ''
  document.getElementById('warranty')?.innerText = {
    'in': '有保卡（保固內）',
    'out': '有保卡（過保）',
    'none': '沒有保卡'
  }[d.warranty] || ''

  document.getElementById('contactInfo')?.innerText = `${d.customer || ''}（LINE: ${d.line || ''}，${d.phone || ''}）`
  document.getElementById('addressLine')?.innerText = d.address || ''
  document.getElementById('product')?.innerText = d.product || ''
  document.getElementById('description')?.innerText = d.description || ''
}
