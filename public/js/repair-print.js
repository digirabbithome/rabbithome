import { db } from '/js/firebase.js'
import {
  doc, getDoc
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'

window.onload = async () => {
  const params = new URLSearchParams(window.location.search)
  const repairId = params.get('id')
  if (!repairId) return

  const docRef = doc(db, 'repairs', repairId)
  const docSnap = await getDoc(docRef)

  if (!docSnap.exists()) return

  const data = docSnap.data()
  document.getElementById('repairId').innerText = data.repairId || ''
  document.getElementById('createdAt').innerText = data.createdAt?.toDate?.().toLocaleDateString() || ''
  document.getElementById('product').innerText = data.product || ''
  document.getElementById('description').innerText = data.description || ''
  document.getElementById('staff').innerText = data.nickname || ''
  document.getElementById('warranty').innerText = data.warranty || ''

  const contactParts = [data.customer, data.phone, data.line].filter(Boolean)
  document.getElementById('contactInfo').innerText = contactParts.join('　')

  if (data.address) {
    document.getElementById('address').innerText = data.address
    document.getElementById('addressBlock').style.display = ''
  }
}
