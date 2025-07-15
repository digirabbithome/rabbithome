import { db } from '/js/firebase.js'
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'

window.onload = async () => {
  const params = new URLSearchParams(window.location.search)
  const repairId = params.get('id')
  const docRef = doc(db, 'repairs', repairId)
  const docSnap = await getDoc(docRef)
  const d = docSnap.exists() ? docSnap.data() : {}

  document.getElementById('repairId').innerText = repairId || ''
  document.getElementById('createdAt').innerText = d.createdAt?.toDate?.().toLocaleDateString?.() || ''
  document.getElementById('nickname').innerText = d.nickname || localStorage.getItem('nickname') || ''

  const name = d.customer || ''
  const phone = d.phone || ''
  const line = d.line || ''
  const address = d.address || ''

  const contactLine = `${name}　${phone}　${line ? 'LINE: ' + line : ''}`
  document.getElementById('contactInfo').innerText = contactLine
  if (address) {
    document.getElementById('addressLine').style.display = 'block'
    document.getElementById('address').innerText = address
  }

  document.getElementById('product').innerText = d.product || ''
  document.getElementById('description').innerText = d.description || ''
  document.getElementById('warranty').innerText = d.warranty || ''
}
