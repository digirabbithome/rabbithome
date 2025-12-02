// === Rabbithome 公布欄清理工具 clean-db.js v1 ===
import { db } from '/js/firebase.js'
import {
  collection,
  getDocs,
  deleteDoc,
  doc
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'

const BULLETIN_COLLECTION = 'bulletins'
const CLEAN_DAYS = 21 // 三週

// DOM helpers
const $ = (sel) => document.querySelector(sel)
const logArea = () => document.querySelector('#log-area')

function appendLog(message, type = 'info') {
  const area = logArea()
  if (!area) return
  const line = document.createElement('div')
  line.className = `log-line ${type}`
  const ts = new Date().toLocaleTimeString('zh-TW', { hour12: false })
  line.textContent = `[${ts}] ${message}`
  area.appendChild(line)
  area.scrollTop = area.scrollHeight
}

// 三週前日期
function cutoffDate() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - CLEAN_DAYS)
  return d
}

// 判斷是否可刪
function isDeletable(data, cutoff) {
  const markState = data.markState || 'none'
  const createdAt = data.createdAt?.toDate?.()

  const isHidden = markState === 'hidden'
  const isOld = createdAt instanceof Date && createdAt < cutoff

  return isHidden || isOld
}

// --- 計算 ---
async function calculateBulletins() {
  const resultCell = document.querySelector('#result-bulletins')
  const cutoff = cutoffDate()

  appendLog(`🔍 開始計算：hidden 或 createdAt < ${cutoff.toISOString()}`, 'info')
  if (resultCell) resultCell.textContent = '計算中…'

  try {
    const snap = await getDocs(collection(db, BULLETIN_COLLECTION))
    const total = snap.size
    let deletable = 0

    snap.forEach(docSnap => {
      if (isDeletable(docSnap.data(), cutoff)) deletable++
    })

    if (resultCell) resultCell.textContent = `${deletable} / ${total}`
    appendLog(`✅ 計算完成：可刪 ${deletable} / 總筆數 ${total}`, 'success')
  } catch (err) {
    if (resultCell) resultCell.textContent = '計算失敗'
    appendLog(`❌ 錯誤：${err.message}`, 'error')
  }
}

// --- 清理 ---
async function cleanBulletins() {
  const cutoff = cutoffDate()
  const ok = confirm(
    `即將刪除 hidden 或超過三週的公告。\n此動作無法復原，確定嗎？`
  )
  if (!ok) return

  appendLog('🧹 開始清理公布欄舊資料…', 'info')
  const resultCell = document.querySelector('#result-bulletins')
  if (resultCell) resultCell.textContent = '清理中…'

  try {
    const snap = await getDocs(collection(db, BULLETIN_COLLECTION))
    let deleted = 0
    const total = snap.size

    for (const docSnap of snap.docs) {
      if (isDeletable(docSnap.data(), cutoff)) {
        await deleteDoc(doc(db, BULLETIN_COLLECTION, docSnap.id))
        deleted++
      }
    }

    if (resultCell) resultCell.textContent = `已刪除 ${deleted} / 原總數 ${total}`
    appendLog(`✅ 清理完成：刪除 ${deleted} 筆`, 'success')
  } catch (err) {
    if (resultCell) resultCell.textContent = '清理失敗'
    appendLog(`❌ 錯誤：${err.message}`, 'error')
  }
}

// --- 初始化 ---
window.onload = () => {
  document.querySelector('#btn-calc-bulletins')?.addEventListener('click', calculateBulletins)
  document.querySelector('#btn-clean-bulletins')?.addEventListener('click', cleanBulletins)

  document.querySelector('#clear-log')?.addEventListener('click', () => {
    const area = logArea()
    if (area) area.innerHTML = ''
  })

  appendLog('🧹 公布欄清理工具已載入，請先按「計算」。', 'info')
}
