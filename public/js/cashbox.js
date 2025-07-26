import {
  db, doc, getDoc, updateDoc, setDoc, addDoc,
  collection, serverTimestamp, getDocs, query, orderBy
} from '/js/firebase-cashbox.js'

const nickname = localStorage.getItem('nickname') || '未知使用者'
const statusRef = doc(db, 'cashbox-status', 'main')
const recordsRef = collection(db, 'cashbox-records')
const changeDocRef = doc(db, 'cashbox-change-request', new Date().toISOString().split('T')[0])

const changeCoins = ['5', '10', '50', '100', '500']
const changeState = {}

function showToast(message) {
  const div = document.createElement('div')
  div.className = 'toast'
  div.textContent = message
  document.querySelector('.form-block').appendChild(div)
  setTimeout(() => div.remove(), 4000)
}

function setupChangeButtons() {
  const container = document.getElementById('change-request')
  changeCoins.forEach(coin => {
    const btn = document.createElement('button')
    btn.className = 'coin-btn'
    btn.textContent = coin
    btn.dataset.value = coin
    btn.onclick = () => toggleCoin(btn)
    container.appendChild(btn)
    changeState[coin] = false
  })
}

function toggleCoin(btn) {
  const coin = btn.dataset.value
  changeState[coin] = !changeState[coin]
  btn.classList.toggle('active', changeState[coin])
  saveChangeRequest()
}

async function saveChangeRequest() {
  await setDoc(changeDocRef, {
    date: new Date().toISOString().split('T')[0],
    coins: changeState,
    updatedBy: nickname,
    updatedAt: serverTimestamp()
  })
}

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

  const docs = snapshot.docs.slice(0, 30)
  docs.forEach(doc => {
    const d = doc.data()
    const ts = d.createdAt?.toDate?.()
    const dateStr = ts ? `${ts.getMonth()+1}/${ts.getDate()} ${ts.getHours()}:${String(ts.getMinutes()).padStart(2,'0')}` : ''

    const typeMap = {
      'in': '存入',
      'out': '提領',
      'exchange': '換錢',
      'reset': '重設'
    }
    const action = typeMap[d.type] || d.type
    let text = ''

    if (d.type === 'reset') {
      text = `🛠️ ${d.user} ${dateStr} 重設 $${d.amount.toLocaleString()}（原為 $${d.beforeAmount?.toLocaleString() || 0}）`;
    } else {
      const reasonText = d.reason?.trim() ? `｜${d.reason.trim()}` : ''
      text = `📌 ${d.user} ${dateStr} ${action} $${d.amount.toLocaleString()} ${reasonText} ➜ 餘額 $${d.balanceAfter?.toLocaleString()}`
    }

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

  if (isNaN(amount) || amount <= 0) {
    alert('請輸入有效金額')
    return
  }

  let current = await loadBalance()
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
    showToast(`✅ ${nickname} 將錢櫃重設為 $${amount.toLocaleString()}（原為 $${current.toLocaleString()}）`)
  } else if (type === 'out') {
    payload.amount = amount
    payload.balanceAfter = current - amount
    await updateDoc(statusRef, { amount: payload.balanceAfter, updatedAt: serverTimestamp(), updatedBy: nickname })
    showToast(`✅ ${nickname} 提領 $${amount.toLocaleString()}，餘額 $${payload.balanceAfter.toLocaleString()}`)
  } else if (type === 'in') {
    payload.amount = amount
    payload.balanceAfter = current + amount
    await updateDoc(statusRef, { amount: payload.balanceAfter, updatedAt: serverTimestamp(), updatedBy: nickname })
    showToast(`✅ ${nickname} 存入 $${amount.toLocaleString()}，餘額 $${payload.balanceAfter.toLocaleString()}`)
  } else if (type === 'exchange') {
    payload.amount = amount
    payload.balanceAfter = current
    showToast(`✅ ${nickname} 換錢 $${amount.toLocaleString()}，餘額 $${current.toLocaleString()}`)
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
  setupChangeButtons()

  document.querySelectorAll('.actions button').forEach(btn => {
    btn.addEventListener('click', () => {
      handleAction(btn.dataset.type)
    })
  })
}