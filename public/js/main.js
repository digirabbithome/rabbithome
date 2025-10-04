// js/main.js 2025-10-04 robust version with badge count
import { db } from '/js/firebase.js'
import { collection, getDocs } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'

// iframe 導航邏輯
window.navigate = function (page) {
  const frame = document.getElementById('content-frame')
  if (frame) frame.src = page
}

// 折疊功能
window.toggleMenu = function (id) {
  const el = document.getElementById(id)
  if (!el) return
  el.style.display = el.style.display === 'block' ? 'none' : 'block'
}

// 登出
window.logout = function () {
  localStorage.removeItem('rabbitUser')
  location.href = '/login.html'
}
// ===== 🧽 環境整理紅圈數字（以本地“整天差”計算） =====
import { db } from '/js/firebase.js'
import { collection, getDocs } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'

const DAY = 86400000

// 將任何格式轉成 Date（支援 Timestamp / seconds / ISO）
function toDateSafe(v){
  if (!v) return null
  try{
    if (typeof v?.toDate === 'function') return v.toDate()
    if (v?.seconds && Number.isFinite(v.seconds)) return new Date(v.seconds * 1000)
    return new Date(v)
  }catch(e){
    console.warn('[badge] toDateSafe failed:', v, e)
    return null
  }
}

// 以「本地日曆日」計算：忽略時分秒，只看日期差
function daysDiffByLocalDay(from, to){
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate())      // 今日 00:00
  const b = new Date(to.getFullYear(),   to.getMonth(),   to.getDate())        // 到期日 00:00
  return Math.floor((b - a) / DAY)   // 可為負數（過期）
}

async function countEnvWaiting(){
  try{
    const snap = await getDocs(collection(db, 'cleanCycleTasks'))
    const now  = new Date()
    let waiting = 0

    snap.forEach(doc => {
      const d = doc.data() || {}

      // 欄位兼容
      const lastRaw  = d.last ?? d.lastCompleted ?? d.lastCompletedAt ?? d.lastCleanedAt
      const cycleRaw = d.days ?? d.cycleDays ?? d.cycle ?? d.interval
      const days = parseInt(cycleRaw ?? 0, 10)
      const last = toDateSafe(lastRaw)

      // 規則 A：從未清潔 + 有設定週期 => 等待清潔
      if (!last && days > 0){
        waiting++
        console.log('[badge] never cleaned => counted', {id: doc.id, days})
        return
      }
      // 缺欄位 => 跳過
      if (!last || !days){
        console.log('[badge] skip missing', {id: doc.id, last: lastRaw, days: cycleRaw})
        return
      }

      // 計算下次到期日（忽略時分秒）
      const dueAt = new Date(last.getTime() + days * DAY)
      const restDays = daysDiffByLocalDay(now, dueAt)  // 以“整天”計算
      const counted  = (restDays <= 2)                 // 過期(負) + 0~2 天內
      if (counted) waiting++

      console.log('[badge] item', {
        id: doc.id,
        last: last.toISOString().slice(0,10),
        days,
        due: dueAt.toISOString().slice(0,10),
        restDays,
        counted
      })
    })

    console.log('[badge] 總待清潔(過期+≤2天+未清):', waiting)
    return waiting
  }catch(err){
    console.error('[badge] fetch error:', err)
    return 0
  }
}

function setBadge(n){
  const el = document.getElementById('cycle-badge')
  if (!el) return
  if (Number(n) > 0){
    el.textContent = String(n)
    el.style.display = 'inline-flex'
  }else{
    el.style.display = 'none'
  }
}

async function updateBadge(){
  const n = await countEnvWaiting()
  setBadge(n)
}

// 進頁面即更新 & 每 3 小時更新
window.addEventListener('DOMContentLoaded', updateBadge)
window.addEventListener('load', updateBadge)
setInterval(updateBadge, 3 * 60 * 60 * 1000)
