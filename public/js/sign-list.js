
import { db } from '/js/firebase.js'
import {
  collection, query, orderBy, getDocs
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'

// 檢查登入狀態（若無 nickname，跳回 login.html）
const nickname = localStorage.getItem('nickname')
if (!nickname) {
  alert('請先登入帳號')
  window.location.href = '/login.html'
}

// 讀取紀錄
async function loadRecords() {
  const q = query(collection(db, 'signs'), orderBy('createdAt', 'desc'))
  const snapshot = await getDocs(q)
  const container = document.getElementById('record-list')
  container.innerHTML = ''

  snapshot.forEach(doc => {
    const d = doc.data()
    const div = document.createElement('div')
    div.className = 'record'
    div.innerHTML = `
      <img src="${d.signatureURL}" alt="簽名">
      <div class="info">
        <div><strong>金額：</strong>${d.amount}</div>
        <div><strong>身份：</strong>${d.category} - ${d.subCategory}</div>
        <div><strong>紀錄人：</strong>${d.nickname}</div>
        <div><strong>備註：</strong>${d.notes || ''}</div>
      </div>
    `
    container.appendChild(div)
  })
}
loadRecords()
