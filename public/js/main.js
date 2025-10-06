// === Rabbithome 主頁 main.js ===
/* 版本：2025-10-06h
   功能：導航 + 暱稱顯示 + 🧽/🔋/🗓️/💰/📌 五項徽章
   - Leave: 只算 年假(type='annual') + 待審核(pending) + 未結束(end>=today, TPE)
   - Cashbox: 今日有未歸零且金額≠0 的差額 → 綠色✖️
   - Bulletin(環境整潔): 今天 markState 不為 highlight/pink/hidden 視為未處理，顯示筆數 */
import { auth, db } from '/js/firebase.js'
import { doc, getDoc, collection, getDocs, collectionGroup, query, where } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'
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
const daysDiff = (a,b)=>{ const A=new Date(a.getFullYear(),a.getMonth(),a.getDate()), B=new Date(b.getFullYear(),b.getMonth(),b.getDate()); return Math.floor((B-A)/DAY) }

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

// ---------------- 💰 Cashbox Diff Badge ----------------
// 今日有「未歸零且金額≠0」的紀錄 → 顯示綠圈 ✖️
const _todayYMD = (typeof todayYMD_TPE === 'function')
  ? todayYMD_TPE
  : () => new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())

async function countCashMismatchToday(){
  try{
    const today = _todayYMD()
    const q = query(collection(db, 'cashbox-diffs'), where('date', '==', today))
    const snap = await getDocs(q)

    let hasMismatch = false
    snap.forEach(d => {
      if (hasMismatch) return
      const x = d.data() || {}
      const amount = Number(x.amount ?? 0)
      const zeroed = !!x.zeroed
      if (!zeroed && Math.abs(amount) > 0.0001) hasMismatch = true
    })
    return hasMismatch ? 1 : 0
  }catch(e){
    console.error('[badge:cashdiff] error', e)
    return 0
  }
}
function setCashDiffBadge(flag){
  const el = document.getElementById('cashdiff-badge')
  if (!el) return
  if (flag){
    el.textContent = '✖️'
    el.style.display = 'inline-flex'
    el.style.backgroundColor = '#10b981' // 綠色
    el.title = '今日外場錢櫃金額有出入'
  }else{
    el.style.display = 'none'
  }
}
async function updateCashDiffBadge(){
  const n = await countCashMismatchToday()
  setCashDiffBadge(n)
}
window.addEventListener('DOMContentLoaded', updateCashDiffBadge)
window.addEventListener('load', updateCashDiffBadge)
setInterval(updateCashDiffBadge, 30 * 60 * 1000)
onAuthStateChanged(auth, async (u)=>{ if(!u) return; await updateCashDiffBadge() })

// ---------------- 📌 Bulletin「環境整潔」Badge ----------------
// 今天(台北) visibleTo 包含「環境整潔」，且 markState 非 highlight/pink/hidden 視為「未處理」
function dayRangeTPE(){
  const ymd = todayYMD_TPE()
  const start = new Date(`${ymd}T00:00:00+08:00`)
  const end = new Date(start.getTime() + DAY) // +1 天
  return { start, end }
}
async function countBulletinEnvUnprocessedToday(){
  const { start, end } = dayRangeTPE()
  try{
    let snap
    // 推薦路徑（需索引：visibleTo array-contains + createdAt ASC）
    try{
      const q1 = query(
        collection(db,'bulletins'),
        where('visibleTo','array-contains','環境整潔'),
        where('createdAt','>=', start),
        where('createdAt','<',  end)
      )
      snap = await getDocs(q1)
    }catch(_){
      // 退回：僅用 array-contains，日期前端過濾
      const q2 = query(collection(db,'bulletins'), where('visibleTo','array-contains','環境整潔'))
      snap = await getDocs(q2)
    }
    let n = 0
    snap.forEach(d=>{
      const x = d.data() || {}
      const ts = x.createdAt?.toDate?.()
      if (!ts || ts < start || ts >= end) return
      const state = x.markState || 'none'
      // 未處理：不是 highlight/pink/hidden
      if (state !== 'highlight' && state !== 'pink' && state !== 'hidden') n++
    })
    return n
  }catch(e){
    console.error('[badge:bulletin-env] error', e)
    return 0
  }
}
function setBulletinCleanBadge(n){
  const el = document.getElementById('bulletin-clean-badge')
  if (!el) return
  if (Number(n) > 0){ el.textContent = String(n); el.style.display = 'inline-flex'; el.title = '今天環境整潔未處理筆數' }
  else { el.style.display = 'none' }
}
async function updateBulletinCleanBadge(){
  const n = await countBulletinEnvUnprocessedToday()
  setBulletinCleanBadge(n)
}
window.addEventListener('DOMContentLoaded', updateBulletinCleanBadge)
window.addEventListener('load', updateBulletinCleanBadge)
setInterval(updateBulletinCleanBadge, 60 * 60 * 1000)
onAuthStateChanged(auth, async (u)=>{ if(!u) return; await updateBulletinCleanBadge() })

// === EOF ===
