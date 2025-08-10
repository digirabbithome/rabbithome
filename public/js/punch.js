import { db, auth } from '/js/firebase.js'
import { collection, addDoc, serverTimestamp, query, where, getDocs } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js'

const pad2 = n => String(n).padStart(2, '0')
let me, yyyymm

window.onload = () => {
  onAuthStateChanged(auth, async (user) => {
    if (!user) { alert('請先登入'); return }
    me = user
    const now = new Date()
    yyyymm = `${now.getFullYear()}${pad2(now.getMonth() + 1)}`
    document.getElementById('me').textContent = me.email || ''
    bindActions()
    await loadToday()
  })
}

function bindActions() {
  document.getElementById('btnIn').onclick = () => punch('in')
  document.getElementById('btnOut').onclick = () => punch('out')
}

async function punch(kind) {
  const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
  await addDoc(collection(db, 'punches', me.uid, yyyymm), {
    date: today,                // 查詢用
    kind,                       // 'in' or 'out'
    at: new Date().toISOString(),
    createdAt: serverTimestamp()
  })
  await loadToday()
}

async function loadToday() {
  const today = new Date().toISOString().slice(0, 10)
  // ✅ 不加 orderBy，避免複合索引；改前端排序
  const q = query(collection(db, 'punches', me.uid, yyyymm), where('date', '==', today))
  const snap = await getDocs(q)
  const rows = []
  snap.forEach(d => rows.push({ id: d.id, ...d.data() }))

  // 以 at 欄位排序（字串 ISO 時間可直接比較）
  rows.sort((a, b) => (a.at || '').localeCompare(b.at || ''))

  const list = document.getElementById('todayList')
  list.innerHTML = rows.length
    ? rows.map(r => `<div class="row">${(r.at || '').slice(11, 19)}　${r.kind === 'in' ? '上班' : '下班'}</div>`).join('')
    : '<div class="row">今天尚無打卡</div>'
}
