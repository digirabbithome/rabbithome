
import { db } from '/js/firebase.js'
import {
  collection, query, where, getDocs
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'

window.onload = async () => {
  const debugBox = document.getElementById('debug')
  const log = (msg) => debugBox.innerHTML += `<div style='color:#c00;'>🔍 ${msg}</div>`

  const params = new URLSearchParams(window.location.search)
  const repairId = params.get('id') || ''
  log(`目前 repairId 是：${repairId}`)

  if (!repairId) {
    log('❌ 沒有帶入 repairId 參數')
    return
  }

  const q = query(collection(db, 'repairs'), where('repairId', '==', repairId))
  const snapshot = await getDocs(q)

  if (snapshot.empty) {
    log('❌ 查無維修單資料')
    return
  }

  const d = snapshot.docs[0].data()
  log('✅ 已查到資料')
  log(`顧客：${d.customer || '未填寫'}，商品：${d.product || '未填寫'}`)

  document.title = `維修單 ${repairId}`
  document.getElementById('repairId').innerText = repairId
  document.getElementById('company').innerText = d.senderCompany || ''
  document.getElementById('warranty').innerText = d.warranty || ''
  document.getElementById('product').innerText = d.product || ''
  document.getElementById('description').innerText = d.description || ''

  const line = d.line ? `（LINE: ${d.line}）` : ''
  const customerText = [
    `${d.customer || ''} ${line}`,
    d.phone || '',
    d.address || ''
  ].filter(x => x).join('<br>')
  document.getElementById('customerInfo').innerHTML = customerText
}
