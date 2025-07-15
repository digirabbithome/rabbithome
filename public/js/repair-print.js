
import { db } from '/js/firebase.js'
import {
  collection, query, where, getDocs
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'

window.onload = async () => {
  const nickname = localStorage.getItem('nickname') || '（未登入）'
  const handlerEl = document.getElementById('staffNickname')
  if (handlerEl) handlerEl.innerText = nickname

  const params = new URLSearchParams(window.location.search)
  const repairId = params.get('id') || ''
  if (!repairId) return

  const q = query(collection(db, 'repairs'), where('repairId', '==', repairId))
  const snapshot = await getDocs(q)
  if (snapshot.empty) return

  const d = snapshot.docs[0].data()

  // 維修單號顯示
  document.title = `維修單 ${repairId}`
  const repairIdText = document.getElementById('repairIdText')
  if (repairIdText) repairIdText.innerText = repairId

  // 顯示 填單日期 + 保固狀態
  const repairDateWarrantyEl = document.getElementById("repairDateWarranty")
  if (d.createdAt && d.warrantyStatus && repairDateWarrantyEl) {
    const date = d.createdAt.toDate()
    const dateStr = `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`
    repairDateWarrantyEl.textContent = `${dateStr}　${d.warrantyStatus}`
  }

  // 顯示 客戶資料 單行
  const ciEl = document.getElementById("customerInfo")
  if (ciEl) {
    const name = d.customer || ""
    const phone = d.phone || ""
    const address = d.address || ""
    const line = d.line ? `（LINE: ${d.line}）` : ""
    ciEl.textContent = `${name} ${line} ${phone} ${address}`.trim()
  }

  // 顯示商品與描述
  document.getElementById('product').innerText = d.product || ''
  document.getElementById('description').innerText = d.description || ''
}
