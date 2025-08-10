import { db, auth } from '/js/firebase.js'
import { collection, addDoc, getDocs, query, where, orderBy, doc, updateDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js'

const pad2=n=>String(n).padStart(2,'0')
let me

window.onload=()=>{
  onAuthStateChanged(auth, async u=>{
    if(!u){ alert('請先登入'); return }
    me=u
    document.getElementById('me').textContent = me.email || me.uid
    bindUI(); await refreshToday()
  })
}

function nowIso(){ return new Date().toISOString() }
function yyyymm(d=new Date()){ return `${d.getFullYear()}${pad2(d.getMonth()+1)}` }
function yyyy_mm_dd(d=new Date()){ return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}` }

function bindUI(){
  document.getElementById('clockIn').onclick = async ()=>{
    const col = collection(db,'punches', me.uid, yyyymm())
    await addDoc(col, { in: nowIso(), date: yyyy_mm_dd(), createdAt: serverTimestamp() })
    await refreshToday()
  }
  document.getElementById('clockOut').onclick = async ()=>{
    const col = collection(db,'punches', me.uid, yyyymm())
    const q = query(col, where('date','==', yyyy_mm_dd()), orderBy('createdAt','desc'))
    const snap = await getDocs(q)
    const open = snap.docs.find(d => !d.data().out)
    if(!open){ alert('找不到未結束的上班紀錄，請先「上班打卡」'); return }
    await updateDoc(doc(db, open.ref.path), { out: nowIso() })
    await refreshToday()
  }
}

async function refreshToday(){
  const col = collection(db,'punches', me.uid, yyyymm())
  const q = query(col, where('date','==', yyyy_mm_dd()), orderBy('createdAt','asc'))
  const snap = await getDocs(q)
  const list = document.getElementById('today')
  if (snap.empty){ list.innerHTML = '<div class="row">今天尚無打卡</div>'; return }
  list.innerHTML = snap.docs.map(d=>{
    const x=d.data()
    const tIn = x.in ? new Date(x.in).toLocaleTimeString() : '-'
    const tOut= x.out? new Date(x.out).toLocaleTimeString() : '（進行中）'
    return `<div class="row"><span class="time">IN ${tIn}</span><span class="time">OUT ${tOut}</span></div>`
  }).join('')
}
