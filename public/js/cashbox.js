import { db, doc, getDoc, setDoc, updateDoc, serverTimestamp } from '/js/firebase.js'

const nickname = localStorage.getItem('nickname') || '未知使用者'

window.onload = async () => {
  const balanceSpan = document.getElementById('current-balance')
  const docRef = doc(db, 'cashbox-status', 'main')
  const snap = await getDoc(docRef)
  const amount = snap.exists() ? snap.data().amount : 0
  balanceSpan.textContent = amount.toLocaleString()

  // 簡化：實際版本會根據 tab 顯示不同表單
  document.getElementById('tab-content').innerHTML = '<p>功能表單稍後加入</p>'
}
