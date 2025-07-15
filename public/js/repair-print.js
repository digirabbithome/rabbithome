
import { db } from '/js/firebase.js'
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'

window.onload = async () => {
  const urlParams = new URLSearchParams(window.location.search)
  const id = urlParams.get('id')
  if (!id) return

  const docRef = doc(db, 'repairs', id)
  const docSnap = await getDoc(docRef)

  if (docSnap.exists()) {
    const data = docSnap.data()
    document.getElementById('repairId').innerText = data.repairId || ''
    document.getElementById('createdAt').innerText = data.createdAt?.toDate().toLocaleString('zh-TW') || ''
    document.getElementById('handler').innerText = data.nickname || ''
    document.getElementById('warranty').innerText = data.warranty || ''
    document.getElementById('contactInfo').innerText = `${data.customer || ''}　${data.phone || ''}　${data.line || ''}`
    document.getElementById('addressLine').innerText = data.address || ''
    document.getElementById('product').innerText = data.product || ''
    document.getElementById('description').innerText = data.description || ''
  }
}
