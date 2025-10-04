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

// ===== 🧽 環境整理紅圈數字系統 =====
const DAY = 86400000

function toDateSafe(v) {
  if (!v) return null
  try {
    if (typeof v.toDate === 'function') return v.toDate()
    if (v.seconds && Number.isFinite(v.seconds)) return new Date(v.seconds * 1000)
    return new Date(v)
  } catch (e) {
    console.warn('[badge] 無法轉換日期', v)
    return null
  }
}

function floorDays(ms) {
  return Math.floor(ms / DAY)
}

async function countEnvWaiting() {
  try {
    const snap = await getDocs(collection(db, 'cleanCycleTasks'))
    const now = new Date()
    let waiting = 0

    snap.forEach(doc => {
      const d = doc.data() || {}
      const lastRaw = d.last || d.lastCompleted || d.lastCompletedAt || d.lastCleanedAt
      const cycleRaw = d.days || d.cycleDays || d.cycle || d.interval
      const days = parseInt(cycleRaw ?? 0, 10)
      const last = toDateSafe(lastRaw)
      if (!last || !days) return

      const dueAt = new Date(last.getTime() + days * DAY)
      const daysLeft = floorDays(dueAt - now)
      const counted = daysLeft <= 2 // 兩天內 or 已過期都算待清潔
      if (counted) waiting++
      console.log('[badge] 檢查:', doc.id, { last: last.toISOString().slice(0, 10), days, dueAt: dueAt.toISOString().slice(0, 10), daysLeft, counted })
    })

    console.log('[badge] 總待清潔:', waiting)
    return waiting
  } catch (err) {
    console.error('[badge] 讀取錯誤:', err)
    return 0
  }
}

function setBadge(num) {
  const el = document.getElementById('cycle-badge')
  if (!el) return
  if (Number(num) > 0) {
    el.textContent = String(num)
    el.style.display = 'inline-flex'
  } else {
    el.style.display = 'none'
  }
}

async function updateBadge() {
  const n = await countEnvWaiting()
  setBadge(n)
}

// 初始與定期更新
window.addEventListener('DOMContentLoaded', updateBadge)
window.addEventListener('load', updateBadge)
setInterval(updateBadge, 3 * 60 * 60 * 1000) // 每3小時更新一次
