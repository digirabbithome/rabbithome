import { db, auth } from '/js/firebase.js'
import { collection, addDoc, serverTimestamp, query, where, getDocs } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js'

const fmtDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' })
const fmtTime = new Intl.DateTimeFormat('zh-TW', { timeZone: 'Asia/Taipei', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
function todayTPE(){ return fmtDate.format(new Date()) }
function nowTimeTPE(){ return fmtTime.format(new Date()) }
function formatToTPE(dtLike){
  const d = dtLike?.toDate ? dtLike.toDate() : (dtLike instanceof Date ? dtLike : new Date(dtLike))
  const dstr = fmtDate.format(d), tstr = fmtTime.format(d)
  return `${dstr} ${tstr}`
}

const pad2 = n => String(n).padStart(2, '0')
let me, yyyymm

window.onload = () => {
  onAuthStateChanged(auth, async (user) => {
    if (!user) { alert('請先登入'); return }
    me = user
    const dstr = todayTPE()
    yyyymm = dstr.slice(0,7).replace('-', '')
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
  const localDate = todayTPE()
  const localTime = nowTimeTPE()
  const atISO = new Date().toISOString()
  await addDoc(collection(db, 'punches', me.uid, yyyymm), {
    date: localDate,
    kind,
    at: atISO,
    atTPE: `${localDate} ${localTime}`,
    tz: 'Asia/Taipei',
    createdAt: serverTimestamp()
  })
  await loadToday()
}

async function loadToday() {
  const localDate = todayTPE()
  const q = query(collection(db, 'punches', me.uid, yyyymm), where('date', '==', localDate))
  const snap = await getDocs(q)
  const rows = []
  snap.forEach(d => rows.push({ id: d.id, ...d.data() }))
  rows.sort((a, b) => {
    const ta = a.atTPE || formatToTPE(a.at || a.createdAt || new Date())
    const tb = b.atTPE || formatToTPE(b.at || b.createdAt || new Date())
    return ta.localeCompare(tb)
  })
  const list = document.getElementById('todayList')
  list.innerHTML = rows.length
    ? rows.map(r => {
        const show = r.atTPE || formatToTPE(r.at || r.createdAt || new Date())
        return `<div class="row">${show.slice(11, 19)}　${r.kind === 'in' ? '上班' : '下班'}</div>`
      }).join('')
    : '<div class="row">今天尚無打卡</div>'
}
