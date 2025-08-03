
// 匯入 Firebase 函式
import {
  db, collection, addDoc, serverTimestamp, doc, getDoc, updateDoc, getDocs
} from '/js/firebase.js'

const nickname = localStorage.getItem('nickname') || '未知使用者'

window.onload = async () => {
  await populatePayerMenu()
  await populateCompanyOptions()
  setupListeners()
}

async function populatePayerMenu() {
  const snapshot = await getDocs(collection(db, 'users'))
  const payerSelect = document.getElementById('payer')
  snapshot.forEach(doc => {
    const data = doc.data()
    const option = document.createElement('option')
    option.value = data.nickname
    option.textContent = data.nickname
    payerSelect.appendChild(option)
  })
}

function setupListeners() {
  document.getElementById('submitBtn').addEventListener('click', async () => {
    const payer = document.getElementById('payer').value || nickname
    const isCashbox = document.getElementById('cashbox-check')?.checked
    const amountStr = document.getElementById('amount')?.value || ''
    const amount = parseInt(amountStr)
    const reason = document.getElementById('reason')?.value.trim() || ''
    const category = document.getElementById('categorySelect')?.value || ''

    // 寫入 sign 表單資料（略）

    if (isCashbox && !isNaN(amount) && amount > 0) {
      await handleCashboxOut(payer, amount, category || reason)
    }
  })
}

async function handleCashboxOut(payer, amount, reason) {
  const statusRef = doc(db, 'cashbox-status', 'main')
  const recordsRef = collection(db, 'cashbox-records')
  const snap = await getDoc(statusRef)
  const currentBalance = snap.exists() ? snap.data().amount : 0
  const newBalance = currentBalance - amount

  await addDoc(recordsRef, {
    user: payer,
    type: 'out',
    amount,
    reason,
    createdAt: serverTimestamp(),
    balanceAfter: newBalance
  })

  await updateDoc(statusRef, {
    amount: newBalance,
    updatedAt: serverTimestamp(),
    updatedBy: payer
  })
}
