// === Rabbithome 主頁 main.js ===
/* 版本：2025-10-06j
   功能：導航 + 暱稱顯示 + 🧽/🔋/🗓️/💰/📌 五項徽章 + 🚗 頭部角標
   排程頻率：
   - 🧽 環境整理：每 6 小時
   - 🔋 電池：每 6 小時（全域 + 登入後）
   - 🗓️ 年假待審：每 12 小時
   - 💰 外場錢櫃：每 4 小時
   - 📌 公布欄「環境整潔」：每 1 小時
   - 🚗 車車（外場、自己發佈、仍顯示、標示中）：每 30 分鐘
*/
import { auth, db } from '/js/firebase.js'
import { doc, getDoc, collection, getDocs, collectionGroup, query, where } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js'

// ---------------- 工具：台北日期 ----------------
const DAY = 86400000
const todayYMD_TPE = () => new Intl.DateTimeFormat('en-CA', { timeZone:'Asia/Taipei', year:'numeric', month:'2-digit', day:'2-digit' }).format(new Date())
const toDateSafe = (v)=>{ try{
  if(!v) return null
  if(typeof v?.toDate==='function') return v.toDate()
  if(v?.seconds) return new Date(v.seconds*1000)
  return new Date(v)
}catch(_){return null} }
const daysDiff = (a,b)=>{ const A=new Date(a.getFullYear(),a.getMonth(),a.getDate()), B=new Date(b.getFullYear(),b.getMonth(),b.getDate()); return Math.floor((B-A)/DAY) }

// 目前登入者顯示名稱（用來比對「自己發佈」）
let CURRENT_PROFILE_NAME = ''

// ---------------- Header 角標：🚗 ----------------
function makeIconBadge(id, icon, color){
  const box = document.createElement('span')
  Object.assign(box.style, {
    position:'relative', display:'inline-flex', alignItems:'center', justifyContent:'center',
    width:'28px', height:'28px', borderRadius:'50%', background:'#f3f4f6', fontSize:'16px', marginLeft:'6px'
  })
  box.textContent = icon
  const num = document.createElement('span')
  num.id = id
  Object.assign(num.style, {
    position:'absolute', top:'-6px', right:'-6px', minWidth:'18px', height:'18px', padding:'0 5px',
    borderRadius:'14px', background: color, color:'#fff', fontSize:'12px',
    lineHeight:'18px', textAlign:'center', display:'none'
  })
  num.textContent = '0'
  box.appendChild(num)
  return box
}
function ensureHeaderBadges(){
  const el = document.getElementById('nickname-display')
  if (!el) return
  if (!document.getElementById('hdr-car')){
    const chip = makeIconBadge('hdr-car', '🚗', '#3b82f6')
    chip.title = '你在外場的標示中項目'
    el.appendChild(chip)
  }
}
function setHeaderBadge(id, n, tooltip=''){
  const num = document.getElementById(id)
  if (!num) return
  if (Number(n) > 0){
    num.textContent = String(n)
    num.style.display = 'inline-block'
  } else {
    num.style.display = 'none'
  }
  if (tooltip) num.parentElement.title = tooltip
}

// ---------------- 基本 UI ----------------
window.addEventListener('load', () => {
  const el = document.getElementById('nickname-display')
  if (!el) return
  onAuthStateChanged(auth, async (user) => {
    if (!user) { el.textContent = '🙋‍♂️ 使用者：未登入'; return }
    const s = await getDoc(doc(db, 'users', user.uid))
    const u = s.data() || {}
    const display = u.nickname || user.displayName || user.email || '未知'
    // 記住「自己發佈」用的名稱（用 nickname；若無則用 displayName；再退回 email 前綴）
    CURRENT_PROFILE_NAME = (u.nickname || user.displayName || (user.email ? user.email.split('@')[0] : '') || '').trim()
    el.textContent = `🙋‍♂️ 使用者：${display}`
    ensureHeaderBadges()
    await updateHeaderCarBadge() // 首次登入就更新一次 🚗
  })
})
window.navigate = (page)=>{ const f=document.getElementById('content-frame'); if(f) f.src=page }
window.toggleMenu = (id)=>{ const el=document.getElementById(id); if(el) el.style.display = (el.style.display==='block'?'none':'block') }
window.logout = ()=>{ try{localStorage.removeItem('rabbitUser')}catch(_){} location.href='/login.html' }

// ---------------- 🧽 環境整理 Badge ----------------
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
// ▶ 每 6 小時
setInterval(updateCycleBadge, 6*60*60*1000)

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
// ▶ 每 6 小時
setInterval(updateBatteryBadge, 6*60*60*1000)
onAuthStateChanged(auth, async (u)=>{ if(!u) return; await updateBatteryBadge(); /* ▶ 每 6 小時 */ setInterval(updateBatteryBadge, 6*60*60*1000) })

// ---------------- 🗓️ Leave Approve Badge ----------------
// 只統計：type='annual' & status='pending'，且 end(yyyy-mm-dd) >= 今天(台北)
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
// ▶ 每 12 小時
setInterval(updateLeaveBadge, 12*60*60*1000)
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
// ▶ 每 4 小時
setInterval(updateCashDiffBadge, 4 * 60 * 60 * 1000)
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
// ▶ 每 1 小時
setInterval(updateBulletinCleanBadge, 60 * 60 * 1000)
onAuthStateChanged(auth, async (u)=>{ if(!u) return; await updateBulletinCleanBadge() })

// ---------------- 🚗 Header：外場（自己發佈 & 標示中 & 仍顯示） ----------------
async function countMyBulletinFlaggedVisible_group(groupName='外場'){
  try{
    const q = query(collection(db,'bulletins'), where('visibleTo','array-contains', groupName))
    const snap = await getDocs(q)
    const me = (CURRENT_PROFILE_NAME || '').trim()
    if (!me) return 0
    let n = 0
    snap.forEach(d=>{
      const x = d.data() || {}
      const author = (x.createdBy || x.nickname || '').trim()
      const state  = x.markState || 'none'
      const visible = state !== 'hidden'
      const flagged = (state === 'highlight') || (state === 'pink') || (x.isStarred === true)
      if (author === me && visible && flagged) n++
    })
    return n
  }catch(e){
    console.error('[hdr car: my bulletin flagged]', e)
    return 0
  }
}
async function updateHeaderCarBadge(){
  try{
    ensureHeaderBadges()
    const n = await countMyBulletinFlaggedVisible_group('外場')
    setHeaderBadge('hdr-car', n, `你的外場標示中項目：${n} 筆`)
  }catch(e){
    console.error('[hdr car update]', e)
  }
}
window.addEventListener('DOMContentLoaded', updateHeaderCarBadge)
window.addEventListener('load', updateHeaderCarBadge)
// ▶ 每 30 分鐘（已調整）
setInterval(updateHeaderCarBadge, 30 * 60 * 1000)
onAuthStateChanged(auth, async (u)=>{ if(!u) return; await updateHeaderCarBadge() })

// === EOF ===
