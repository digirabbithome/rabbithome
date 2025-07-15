
import { db } from '/js/firebase.js'
import {
  doc, getDoc
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'

window.onload = async () => {
  const params = new URLSearchParams(window.location.search)
  const repairId = params.get('id') || ''
  if (!repairId) return

  const nickname = localStorage.getItem('nickname') || '🐰'
  document.getElementById('repairId').innerText = repairId
  document.getElementById('nickname').innerText = nickname

  const snap = await getDoc(doc(db, 'repairs', repairId))
  if (!snap.exists()) return
  const d = snap.data()

  const date = d.createdAt?.toDate?.()
  if (date) {
    document.getElementById('createdAt').innerText =
      `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`
  }

  document.getElementById('warranty').innerText = d.warranty || ''
  document.getElementById('product').innerText = d.product || ''
  document.getElementById('description').innerText = d.description || ''

  const line = d.line ? `（LINE: ${d.line}）` : ''
  const customerText = [
    `${d.customer || ''}${line}`,
    d.phone || '',
    d.address || ''
  ].filter(x => x).join('<br>')
  document.getElementById('customerInfo').innerHTML = customerText

  // 轉成圖像並列印
  const capture = document.getElementById('capture')
  const canvas = await html2canvas(capture, { scale: 2 })
  const img = new Image()
  img.src = canvas.toDataURL("image/png")
  img.style.width = "100%"
  img.onload = () => {
    document.body.innerHTML = ""
    document.body.appendChild(img)
    window.print()
  }
}
