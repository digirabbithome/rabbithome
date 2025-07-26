import { db, doc, getDoc, updateDoc, setDoc, addDoc, collection, serverTimestamp, getDocs, query, orderBy } from '/js/firebase.js'

const nickname = localStorage.getItem('nickname') || '未知使用者'
const statusRef = doc(db, 'cashbox-status', 'main')
const recordsRef = collection(db, 'cashbox-records')

async function loadBalance() {
  const snap = await getDoc(statusRef)
  const amount = snap.exists() ? snap.data().amount : 0
  document.getElementById('current-balance').textContent = amount.toLocaleString()
  return amount
}

async function renderRecords() {
  const q = query(recordsRef, orderBy('createdAt', 'desc'))
  const snapshot = await getDocs(q)
  const recordsDiv = document.getElementById('records')
  recordsDiv.innerHTML = ''

  snapshot.forEach(doc => {
    const d = doc.data()
    const date = d.createdAt?.toDate().toLocaleString() || ''
    let text = ''
    if (d.type === '重設') {
      text = `🛠️ ${d.user} 於 ${date} 將錢櫃重設由 $${d.beforeAmount?.toLocaleString()} ➜ $${d.amount.toLocaleString()}`
    } else {
      text = `📌 ${d.user} 於 ${date} ${d.type} $${d.amount.toLocaleString()} ➜ 餘額 $${d.balanceAfter?.toLocaleString()}`
    }
    if (d.reason) text += `｜備註：${d.reason}`

    const div = document.createElement('div')
    div.className = 'record'
    div.textContent = text
    recordsDiv.appendChild(div)
  })
}

async function handleAction(type) {
  const reason = document.getElementById('reason').value.trim()
  const amtStr = document.getElementById('amount').value
  const amount = parseInt(amtStr)

  if (!reason && type !== 'reset') return alert('請填寫資金用途')
  if ((isNaN(amount) || amount < 0) && type !== 'exchange') return alert('請輸入有效金額')

  let current = await loadBalance()
  let newAmount = current
  let payload = {
    type,
    user: nickname,
    reason,
    createdAt: serverTimestamp()
  }

  if (type === 'reset') {
    payload.beforeAmount = current
    payload.amount = amount
    payload.balanceAfter = amount
    await setDoc(statusRef, { amount, updatedAt: serverTimestamp(), updatedBy: nickname })
  } else if (type === 'out') {
    payload.amount = amount
    payload.balanceAfter = current - amount
    await updateDoc(statusRef, { amount: payload.balanceAfter, updatedAt: serverTimestamp(), updatedBy: nickname })
  } else if (type === 'in') {
    payload.amount = amount
    payload.balanceAfter = current + amount
    await updateDoc(statusRef, { amount: payload.balanceAfter, updatedAt: serverTimestamp(), updatedBy: nickname })
  } else if (type === 'exchange') {
    payload.amount = 0
    payload.balanceAfter = current
  }

  await addDoc(recordsRef, payload)
  document.getElementById('reason').value = ''
  document.getElementById('amount').value = ''
  await loadBalance()
  await renderRecords()
}

window.onload = async () => {
  await loadBalance()
  await renderRecords()

  document.querySelectorAll('.actions button').forEach(btn => {
    btn.addEventListener('click', () => {
      handleAction(btn.dataset.type)
    })
  })
}
