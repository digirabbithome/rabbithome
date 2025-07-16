
import { db } from '/js/firebase.js'
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'

window.onload = async () => {
  const urlParams = new URLSearchParams(window.location.search)
  const id = urlParams.get('id')
  if (!id) return

  const docRef = doc(db, 'repairs', id)
  const docSnap = await getDoc(docRef)
  if (!docSnap.exists()) return

  const data = docSnap.data()
  document.getElementById('repairId').innerText = data.repairId || ''
  document.getElementById('createdAt').innerText = data.createdAt?.toDate().toLocaleString('zh-TW') || ''
  document.getElementById('handler').innerText = data.user || ''
  document.getElementById('warranty').innerText = data.warranty || ''
  document.getElementById('contactInfo').innerText = `${data.customer || ''}　${data.phone || ''}　${data.line || ''}`
  document.getElementById('addressLine').innerText = data.address || ''
  document.getElementById('product').innerText = data.product || ''
  document.getElementById('description').innerText = data.description || ''

  // 自動轉成圖片下載
  if (urlParams.get('download') === '1') {
    setTimeout(() => {
      import('https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js').then(() => {
        const el = document.querySelector('.print-wrapper')
        html2canvas(el).then(canvas => {
          const link = document.createElement('a')
          link.href = canvas.toDataURL('image/png')
          link.download = `${data.repairId || 'repair'}.png`
          link.click()
        })
      })
    }, 800)
  }
}
