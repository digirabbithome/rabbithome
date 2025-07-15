
import { db } from '/js/firebase.js'
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'

window.onload = async () => {
  const params = new URLSearchParams(window.location.search)
  const repairId = params.get('id')
  if (!repairId) return

  const docRef = doc(db, 'repairs', repairId)
  const docSnap = await getDoc(docRef)
  if (!docSnap.exists()) return

  const data = docSnap.data()
  document.getElementById('repairId').textContent = repairId
  const created = data.createdAt?.toDate?.()
  const dateStr = created ? `${created.getFullYear()}/${created.getMonth()+1}/${created.getDate()}` : ''
  document.getElementById('repairDate').textContent = `填單日期：${dateStr}`

  const customerLine = data.line ? `(${data.line})` : ''
  const customerPhone = data.phone ? `(${data.phone})` : ''
  const customerAddr = data.address ? `
${data.address}` : ''
  document.getElementById('customerInfo').textContent = `${data.customer}${customerLine}${customerPhone}${customerAddr}`

  document.getElementById('productName').textContent = data.product || ''
  document.getElementById('warranty').textContent = data.warranty || ''
  document.getElementById('description').textContent = data.description || ''
  document.getElementById('handler').textContent = data.nickname || ''
}
