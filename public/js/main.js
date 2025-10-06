// === Rabbithome 主頁 main.js ===
// 版本：2025-10-06e (final)
// 功能：導航 + 暱稱顯示 + 🧽/🔋/🗓️ 三項紅圈（請假只算年假pending且未結束）

import { auth, db } from '/js/firebase.js'
import {
  doc, getDoc, collection, getDocs, collectionGroup, query, where
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js'

// ---------------- 基本 UI ----------------
window.addEventListener('load', () => {
  const el = document.getElementById('nickname-display')
  if (!el) return
  onAuthStateChanged(auth, async (user) => {
    if (!user) { el.textContent = '🙋‍♂️ 使用者：未登入'; return }
    const s = await getDoc(doc(db, 'users', user.uid))
    const u = s.data() || {}
    el.textContent = `🙋‍♂️ 使用者：${u.nickname || user.displayName || user.email || '未知'}`
  })
})
window.navigate = (page)=>{ const f=document.getElementById('content-frame'); if(f) f.src=page }
window.toggleMenu = (id)=>{ const el=document.getElementById(id); if(el) el.style.display = (el.style.display==='block'?'none':'block') }
window.logout = ()=>{ try{localStorage.removeItem('rabbitUser')}catch(_){} location.href='/login.html' }

// ---------------- 🧽 環境整理 Badge ----------------
const DAY = 86400000
const toDateSafe = (v)=>{ try{
  if(!v) return null
  if(typeof v?.toDate==='function') return v.toDate()
  if(v?.seconds) return new Date(v.seconds*1000)
  return new Date(v)
}catch(_){return null} }
const daysDiff = (a,b)=>{ const A=new Date(a.getFullYear(),a.getMonth(),a.getDate())
  ,B=new Date(b.getFullYear(),b.getMonth(),b.getDate()); return Math.floor((B-A)/DAY) }

async function countEnvWaiting(){
  try{
    const snap=await getDocs(collection(db,'cleanCycleTasks'))
    const now=new Date(); let n=0
    snap.forEach(d=>{
      const x=d.data()||{}
      const last=toDateSafe(x.last??x.lastCompleted??x.lastCompletedAt??x.lastCleanedAt)
      const days=parseInt(x.days??x.cycleDays??x.cycle??x.interval??0,10)
      if(!days) return
      if(!last){ n++; return }
      const due=new Date(last.getTime()+days*DAY)
      if(daysDiff(now,due)<=2) n++
    })
    return n
  }catch(e){ console.error('[badge:clean]',e); return 0 }
}
const setCycleBadge=(n)=>{ const el=document.getElementById('cycle-badge'); if(!el) return
  el.style.display = (n>0?'inline-flex':'none'); if(n>0) el.textContent=String(n) }
async function updateCycleBadge(){ setCycleBadge(await countEnvWaiting()) }
window.addEventListener('DOMContentLoaded',updateCycleBadge)
window.addEventListener('load',updateCycleBadge)
setInterval(updateCycleBadge,3*60*60*1000)

// ---------------- 🔋 Battery Badge ----------------
async function countBatteriesOverdue(){
  try{
    const snap=await getDocs(collection(db,'batteries'))
    let n=0
    const daysSince=(d)=>{ if(!d) return Infinity; const t=new Date(d+(d.length===10?'T00:00:00':'')); if(isNaN(t))return Infinity; return Math.floor((Date.now()-t)/DAY) }
    snap.forEach(d=>{ const x=d.data()||{}; const cd=Math.max(1,Number(x.cycleDays)||30); if(daysSince(x.lastCharge)>=cd) n++ })
    return n
  }catch(e){ console.error('[badge:battery]',e); return 0 }
}
const setBatteryBadge=(n)=>{ const el=document.getElementById('battery-badge'); if(!el) return
  el.style.display=(n>0?'inline-flex':'none'); if(n>0) el.textContent=String(n) }
async function updateBatteryBadge(){ setBatteryBadge(await countBatteriesOverdue()) }
window.addEventListener('DOMContentLoaded',updateBatteryBadge)
window.addEventListener('load',updateBatteryBadge)
setInterval(updateBatteryBadge,60*60*1000)
onAuthStateChanged(auth, async (u)=>{ if(!u) return; await updateBatteryBadge(); setInterval(updateBatteryBadge,3*60*60*1000) })

// ---------------- 🗓️ Leave Approve Badge ----------------
// 只統計：type='annual' & status='pending'，且 end(yyyy-mm-dd) >= 今天(台北)
const todayYMD_TPE=()=> new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())
async function countLeavePending(){
  try{
    const q=query(
      collectionGroup(db,'leaves'),
      where('status','==','pending'),
      where('type','==','annual')
    )
    const snap=await getDocs(q)
    const today=todayYMD_TPE(); let n=0
    snap.forEach(d=>{ const x=d.data()||{}; const end=(x.end||'').slice(0,10); if(end && end>=today) n++ })
    return n
  }catch(e){ console.error('[badge:leave]',e); return 0 }
}
const setLeaveBadge=(n)=>{ const el=document.getElementById('leave-badge'); if(!el) return
  el.style.display=(n>0?'inline-flex':'none'); if(n>0) el.textContent=String(n) }
async function updateLeaveBadge(){ setLeaveBadge(await countLeavePending()) }
window.addEventListener('DOMContentLoaded',updateLeaveBadge)
window.addEventListener('load',updateLeaveBadge)
setInterval(updateLeaveBadge,3*60*60*1000)
onAuthStateChanged(auth, async (u)=>{ if(!u) return; await updateLeaveBadge() })

// === EOF ===
