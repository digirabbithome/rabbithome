// === Rabbithome 主頁 main.js ===
/* 版本：2025-10-06p
   功能：導航 + 暱稱顯示 + 🧽/🔋/🗓️/💰/📌 五項徽章 + 🚚 頭部角標（無數字即隱藏）
   變更：點任一個工作（呼叫 navigate）就會立即刷新所有徽章
   排程頻率：
   - 🧽 環境整理：每 6 小時
   - 🔋 電池：每 6 小時（僅全域排程；登入後只跑一次）
   - 🗓️ 年假待審：每 12 小時
   - 💰 外場錢櫃：每 4 小時
   - 📌 公布欄「環境整潔」（今天）：每 1 小時
   - 🚚 貨車（外場、自己發佈、仍顯示、標示中、近14天）：每 30 分鐘（無數字就隱藏）
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
function dayRangeTPE(){ // 今天 00:00 ~ 明天 00:00
  const ymd = todayYMD_TPE()
  const start = new Date(`${ymd}T00:00:00+08:00`)
  const end = new Date(start.getTime() + DAY)
  return { start, end }
}
// 近 14 天（含今天）：start = 今天00:00 - 13 天；end = 明天00:00
function dayRange14TPE(){
  const { start: todayStart } = dayRangeTPE()
  const start = new Date(todayStart.getTime() - 13 * DAY)
  const end = new Date(todayStart.getTime() + DAY)
  return { start, end }
}

// 目前登入者顯示名稱（用來比對「自己發佈」）
let CURRENT_PROFILE_NAME = ''

// ---------------- Header 角標：🚚（無數字→整顆不顯示；大小沿用 .btn-badge） ----------------
function ensureHeaderTruck(){
  const el = document.getElementById('nickname-display')
  if (!el) return
  if (document.getElementById('hdr-truck-wrap')) return

  const wrap = document.createElement('span')
  wrap.id = 'hdr-truck-wrap'
  Object.assign(wrap.style, {
    display:'none',              // 先隱藏；有數字再顯示
    alignItems:'center',
    marginLeft:'8px'
  })

  const chip = document.createElement('span')
  Object.assign(chip.style, {
    position:'relative', display:'inline-flex', alignItems:'center', justifyContent:'center',
    width:'28px', height:'28px', borderRadius:'50%', background:'#f3f4f6', fontSize:'16px'
  })
  chip.textContent = '🚚'

  const count = document.createElement('span')
  count.id = 'hdr-truck-count'
  count.className = 'btn-badge' // 跟紅色徽章同尺寸
  Object.assign(count.style, { position:'absolute', top:'-6px', right:'-6px', background:'#3b82f6', display:'none' })
  count.textContent = '0'

  chip.appendChild(count)
  wrap.appendChild(chip)
  el.appendChild(wrap)
}
function setHeaderTruckCount(n, tooltip=''){
  const wrap  = document.getElementById('hdr-truck-wrap')
  const count = document.getElementById('hdr-truck-count')
  if (!wrap || !count) return

  if (Number(n) > 0){
    count.textContent = String(n)
    count.style.display = 'inline-flex'
    wrap.style.display  = 'inline-flex'   // 顯示整顆車
    if (tooltip) wrap.title = tooltip
  } else {
    count.style.display = 'none'
    wrap.style.display  = 'none'          // 整顆車隱藏
    wrap.removeAttribute('title')
  }
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
    // 記住「自己發佈」用的名稱（優先 nickname；再 displayName；最後 email 前綴）
    CURRENT_PROFILE_NAME = (u.nickname || user.displayName || (user.email ? user.email.split('@')[0] : '') || '').trim()
    el.textContent = `🙋‍♂️ 使用者：${display}`
    // 首次登入就更新 🚚（update 內會決定是否建立與顯示）
    await updateHeaderTruckBadge()
  })
})
// 點任一個側邊工作 → 立即刷新徽章
window.navigate = async (page)=>{
  const f=document.getElementById('content-frame')
  if(f) f.src=page
  // 等待一小下再刷新，避免同瞬間切頁造成視覺卡頓
  setTimeout(() => { refreshAllBadges() }, 120)
}
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
setInterval(updateCycleBadge, 6*60*60*1000) // 每 6 小時

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
setInterval(updateBatteryBadge, 6*60*60*1000) // 每 6 小時
onAuthStateChanged(auth, async (u)=>{ if(!u) return; await updateBatteryBadge() }) // ← 只跑一次，已移除第二組排程

// ---------------- 🗓️ Leave Approve Badge ----------------
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
setInterval(updateLeaveBadge, 12*60*60*1000) // 每 12 小時
onAuthStateChanged(auth, async (u)=>{ if(!u) return; await updateLeaveBadge() })

// ---------------- 💰 Cashbox Diff Badge ----------------
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
setInterval(updateCashDiffBadge, 4 * 60 * 60 * 1000) // 每 4 小時
onAuthStateChanged(auth, async (u)=>{ if(!u) return; await updateCashDiffBadge() })

// ---------------- 📌 Bulletin「環境整潔」Badge（今天） ----------------
async function countBulletinEnvUnprocessedToday(){
  const { start, end } = dayRangeTPE()
  try{
    let snap
    try{
      const q1 = query(
        collection(db,'bulletins'),
        where('visibleTo','array-contains','環境整潔'),
        where('createdAt','>=', start),
        where('createdAt','<',  end)
      )
      snap = await getDocs(q1)
    }catch(_){
      const q2 = query(collection(db,'bulletins'), where('visibleTo','array-contains','環境整潔'))
      snap = await getDocs(q2)
    }
    let n = 0
    snap.forEach(d=>{
      const x = d.data() || {}
      const ts = x.createdAt?.toDate?.()
      if (!ts || ts < start || ts >= end) return
      const state = x.markState || 'none'
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
setInterval(updateBulletinCleanBadge, 60 * 60 * 1000) // 每 1 小時
onAuthStateChanged(auth, async (u)=>{ if(!u) return; await updateBulletinCleanBadge() })

// ---------------- 🚚 Header：外場（自己發佈 & 標示中 & 仍顯示 & 近14天） ----------------
async function countMyBulletinFlaggedVisible_group14d(groupName='外場'){
  const { start, end } = dayRange14TPE()
  try{
    let snap
    // 推薦路徑：array-contains + createdAt 範圍（需要 Firestore 索引）
    try{
      const q1 = query(
        collection(db,'bulletins'),
        where('visibleTo','array-contains', groupName),
        where('createdAt','>=', start),
        where('createdAt','<',  end)
      )
      snap = await getDocs(q1)
    }catch(_){
      // 退回路徑：先抓群組，再前端依日期過濾
      const q2 = query(collection(db,'bulletins'), where('visibleTo','array-contains', groupName))
      snap = await getDocs(q2)
    }

    const me = (CURRENT_PROFILE_NAME || '').trim()
    if (!me) return 0
    let n = 0

    snap.forEach(d=>{
      const x = d.data() || {}
      const ts = x.createdAt?.toDate?.()
      if (!ts || ts < start || ts >= end) return
      const author = (x.createdBy || x.nickname || '').trim()
      const state  = x.markState || 'none'
      const visible = state !== 'hidden'
      const flagged = (state === 'highlight') || (state === 'pink') || (x.isStarred === true)
      if (author === me && visible && flagged) n++
    })
    return n
  }catch(e){
    console.error('[hdr truck: my bulletin 14d]', e)
    return 0
  }
}
async function updateHeaderTruckBadge(){
  try{
    const n = await countMyBulletinFlaggedVisible_group14d('外場')
    if (n > 0){
      if (!document.getElementById('hdr-truck-wrap')) ensureHeaderTruck()
      setHeaderTruckCount(n, `你的外場標示中項目（近14天）：${n} 筆`)
    } else {
      const wrap = document.getElementById('hdr-truck-wrap')
      if (wrap){ wrap.style.display = 'none'; wrap.removeAttribute('title') }
    }
  }catch(e){
    console.error('[hdr truck update]', e)
  }
}
window.addEventListener('DOMContentLoaded', updateHeaderTruckBadge)
window.addEventListener('load', updateHeaderTruckBadge)
setInterval(updateHeaderTruckBadge, 30 * 60 * 1000) // 每 30 分鐘
onAuthStateChanged(auth, async (u)=>{ if(!u) return; await updateHeaderTruckBadge() })

// ---------------- 一鍵刷新：給 navigate() 用 ----------------
async function refreshAllBadges(){
  try{
    await Promise.allSettled([
      updateCycleBadge(),
      updateBatteryBadge(),
      updateLeaveBadge(),
      updateCashDiffBadge(),
      updateBulletinCleanBadge(),
      updateHeaderTruckBadge()
    ])
  }catch(e){
    console.warn('[refreshAllBadges]', e)
  }
}

// === EOF ===
