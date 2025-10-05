// === Rabbithome 主頁正式整合版 main.js ===
// 版本：2025-10-04
// 功能：導航 + 暱稱顯示 + 🧽 環境整理紅圈 badge

import { auth, db } from '/js/firebase.js'
import { doc, getDoc, collection, getDocs } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js'

// === 暱稱顯示 ===
window.addEventListener('load', async () => {
  const el = document.getElementById('nickname-display')
  if (!el) return
  try {
    onAuthStateChanged(auth, async user => {
      if (!user) {
        el.textContent = '🙋‍♂️ 使用者：未登入'
        return
      }
      const snap = await getDoc(doc(db, 'users', user.uid))
      const data = snap.data() || {}
      el.textContent = `🙋‍♂️ 使用者：${data.nickname || user.displayName || user.email || '未知'}`
    })
  } catch (e) {
    console.warn('[nickname] 載入暱稱失敗', e)
  }
})

// === 導航 ===
window.navigate = function (page) {
  const frame = document.getElementById('content-frame')
  if (frame) frame.src = page
}

// === 展開收合選單 ===
window.toggleMenu = function (id) {
  const el = document.getElementById(id)
  if (!el) return
  el.style.display = (el.style.display === 'block') ? 'none' : 'block'
}

// === 登出 ===
window.logout = function () {
  try { localStorage.removeItem('rabbitUser') } catch (e) {}
  location.href = '/login.html'
}

// === 🧽 環境整理紅圈 Badge ===
const DAY = 86400000

function toDateSafe(v) {
  if (!v) return null
  try {
    if (typeof v?.toDate === 'function') return v.toDate()
    if (v?.seconds && Number.isFinite(v.seconds)) return new Date(v.seconds * 1000)
    return new Date(v)
  } catch (e) {
    console.warn('[badge] toDateSafe failed:', v, e)
    return null
  }
}

function daysDiffByLocalDay(from, to) {
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate())
  const b = new Date(to.getFullYear(), to.getMonth(), to.getDate())
  return Math.floor((b - a) / DAY)
}

async function countEnvWaiting() {
  try {
    const snap = await getDocs(collection(db, 'cleanCycleTasks'))
    const now = new Date()
    let waiting = 0

    snap.forEach(doc => {
      const d = doc.data() || {}
      const lastRaw = d.last ?? d.lastCompleted ?? d.lastCompletedAt ?? d.lastCleanedAt
      const cycleRaw = d.days ?? d.cycleDays ?? d.cycle ?? d.interval
      const days = parseInt(cycleRaw ?? 0, 10)
      const last = toDateSafe(lastRaw)

      // 從未清潔
      if (!last && days > 0) {
        waiting++
        return
      }
      if (!last || !days) return

      const dueAt = new Date(last.getTime() + days * DAY)
      const restDays = daysDiffByLocalDay(now, dueAt)
      if (restDays <= 2) waiting++ // 過期或兩天內
    })

    return waiting
  } catch (err) {
    console.error('[badge] fetch error:', err)
    return 0
  }
}

function setBadge(n) {
  const el = document.getElementById('cycle-badge')
  if (!el) return
  if (Number(n) > 0) {
    el.textContent = String(n)
    el.style.display = 'inline-flex'
  } else {
    el.style.display = 'none'
  }
}

async function updateBadge() {
  const n = await countEnvWaiting()
  setBadge(n)
}

window.addEventListener('DOMContentLoaded', updateBadge)
window.addEventListener('load', updateBadge)
setInterval(updateBadge, 3 * 60 * 60 * 1000)


// === 🔋 Battery Manager Badge ===
async function countBatteriesOverdue() {
  try {
    const snap = await getDocs(collection(db, 'batteries'))
    const today = new Date()
    let overdue = 0
    function daysSince(dstr) {
      if (!dstr) return Infinity
      try {
        const t = new Date(dstr + (dstr.length==10?'T00:00:00':'')).getTime()
        if (isNaN(t)) return Infinity
        return Math.floor((Date.now() - t) / 86400000)
      } catch(e) { return Infinity }
    }
    snap.forEach(d => {
      const x = d.data() || {}
      const cd = Math.max(1, Number(x.cycleDays) || 30)
      const elapsed = daysSince(x.lastCharge || null)
      if (elapsed >= cd) overdue++
    })
    return overdue
  } catch (err) {
    console.error('[badge:battery] fetch error:', err)
    return 0
  }
}

function setBatteryBadge(n) {
  const el = document.getElementById('battery-badge')
  if (!el) return
  if (Number(n) > 0) {
    el.textContent = String(n)
    el.style.display = 'inline-flex'
  } else {
    el.style.display = 'none'
  }
}

async function updateBatteryBadge() {
  const n = await countBatteriesOverdue()
  setBatteryBadge(n)
}

// initialize battery badge
window.addEventListener('DOMContentLoaded', updateBatteryBadge)
window.addEventListener('load', updateBatteryBadge)
setInterval(updateBatteryBadge, 60 * 60 * 1000) // hourly


// initialize battery badge on login, then every 3 hours
onAuthStateChanged(auth, async (user) => {
  if (!user) return
  await updateBatteryBadge()
  setInterval(updateBatteryBadge, 3 * 60 * 60 * 1000) // every 3 hours
})
