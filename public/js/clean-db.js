// === Rabbithome 資料庫清理工具 clean-db.js v4 ===
import { db } from '/js/firebase.js'
import {
  collection,
  getDocs,
  deleteDoc,
  doc
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'

// 公布欄
const BULLETIN_COLLECTION = 'bulletins'
const BULLETIN_CLEAN_DAYS = 21

// 每日工作
const DAILY_COLLECTION = 'dailyCheck'
const DAILY_KEEP_DAYS = 30  // 僅保留最近 30 天（依 doc ID YYYY-MM-DD 判斷）

// 櫃檯取貨
const PICKUP_COLLECTION = 'pickups'
const PICKUP_KEEP_DAYS = 30 // 只刪除「已取貨完成且超過 30 天」

const $ = (s) => document.querySelector(s)
const logArea = () => $('#log-area')

function appendLog(msg, type = 'info') {
  const area = logArea()
  if (!area) return
  const line = document.createElement('div')
  line.className = `log-line ${type}`
  const ts = new Date().toLocaleTimeString('zh-TW', { hour12: false })
  line.textContent = `[${ts}] ${msg}`
  area.appendChild(line)
  area.scrollTop = area.scrollHeight
}

/* ---------- 公布欄 ---------- */

function bulletinCutoffDate() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - BULLETIN_CLEAN_DAYS)
  return d
}

function bulletinIsDeletable(data, cutoff) {
  const mark = data.markState || 'none'
  const created = data.createdAt?.toDate?.()
  const hidden = mark === 'hidden'
  const old = created instanceof Date && created < cutoff
  return hidden || old
}

async function calculateBulletins() {
  const result = $('#result-bulletins')
  const cutoff = bulletinCutoffDate()
  appendLog(`📌 公布欄：計算 hidden 或 createdAt < ${cutoff.toISOString()}`)

  if (result) result.textContent = '計算中…'

  try {
    const snap = await getDocs(collection(db, BULLETIN_COLLECTION))
    const total = snap.size
    let deletable = 0

    snap.forEach(d => { if (bulletinIsDeletable(d.data(), cutoff)) deletable++ })

    if (result) result.textContent = `${deletable} / ${total}`
    appendLog(`✅ 公布欄計算完成：可刪 ${deletable} / 總筆數 ${total}`, 'success')
  } catch (e) {
    if (result) result.textContent = '計算失敗'
    appendLog(`❌ 公布欄錯誤：${e.message}`, 'error')
  }
}

async function cleanBulletins() {
  const cutoff = bulletinCutoffDate()
  const ok = confirm('將刪除 hidden 或超過 21 天的公告，無法復原，確定？')
  if (!ok) return

  const result = $('#result-bulletins')
  if (result) result.textContent = '清理中…'
  appendLog('🧹 開始清理公布欄舊資料…')

  try {
    const snap = await getDocs(collection(db, BULLETIN_COLLECTION))
    const total = snap.size
    let deleted = 0

    for (const d of snap.docs) {
      if (bulletinIsDeletable(d.data(), cutoff)) {
        await deleteDoc(doc(db, BULLETIN_COLLECTION, d.id))
        deleted++
      }
    }

    if (result) result.textContent = `已刪除 ${deleted} / 原總數 ${total}`
    appendLog(`✅ 公布欄清理完成：刪除 ${deleted} 筆`, 'success')
  } catch (e) {
    if (result) result.textContent = '清理失敗'
    appendLog(`❌ 公布欄清理錯誤：${e.message}`, 'error')
  }
}

/* ---------- 每日工作 dailyCheck ---------- */

function dailyCutoffDate() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - DAILY_KEEP_DAYS)
  return d
}

function parseDailyId(id) {
  const parts = id.split('-')
  if (parts.length !== 3) return null
  const [y, m, d] = parts.map(n => parseInt(n, 10))
  if (!y || !m || !d) return null
  const dt = new Date(y, m - 1, d)
  dt.setHours(0, 0, 0, 0)
  return isNaN(dt.getTime()) ? null : dt
}

async function calculateDaily() {
  const result = $('#result-daily')
  const cutoff = dailyCutoffDate()
  appendLog(`📅 每日工作：計算早於 ${cutoff.toISOString().slice(0, 10)} 的紀錄`)

  if (result) result.textContent = '計算中…'

  try {
    const snap = await getDocs(collection(db, DAILY_COLLECTION))
    const total = snap.size
    let deletable = 0

    snap.forEach(d => {
      const dt = parseDailyId(d.id)
      if (!dt || dt < cutoff) deletable++
    })

    if (result) result.textContent = `${deletable} / ${total}`
    appendLog(`✅ 每日工作計算完成：可刪 ${deletable} / 總筆數 ${total}`, 'success')
  } catch (e) {
    if (result) result.textContent = '計算失敗'
    appendLog(`❌ 每日工作錯誤：${e.message}`, 'error')
  }
}

async function cleanDaily() {
  const cutoff = dailyCutoffDate()
  const cutoffStr = cutoff.toISOString().slice(0, 10)
  const ok = confirm(
    `將刪除 ${DAILY_COLLECTION} 中 ${cutoffStr} 以前的每日工作紀錄（僅保留最近 ${DAILY_KEEP_DAYS} 天），無法復原，確定？`
  )
  if (!ok) return

  const result = $('#result-daily')
  if (result) result.textContent = '清理中…'
  appendLog('🧹 開始清理每日工作舊資料…')

  try {
    const snap = await getDocs(collection(db, DAILY_COLLECTION))
    const total = snap.size
    let deleted = 0

    for (const d of snap.docs) {
      const dt = parseDailyId(d.id)
      if (!dt || dt < cutoff) {
        await deleteDoc(doc(db, DAILY_COLLECTION, d.id))
        deleted++
      }
    }

    if (result) result.textContent = `已刪除 ${deleted} / 原總數 ${total}`
    appendLog(`✅ 每日工作清理完成：刪除 ${deleted} 筆`, 'success')
  } catch (e) {
    if (result) result.textContent = '清理失敗'
    appendLog(`❌ 每日工作清理錯誤：${e.message}`, 'error')
  }
}

/* ---------- 櫃檯取貨 pickups ---------- */

function pickupCutoffDate() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - PICKUP_KEEP_DAYS)
  return d
}

function pickupIsDeletable(data, cutoff) {
  const pinStatus = data.pinStatus || 0
  const created = data.createdAt?.toDate?.()
  const isDone = pinStatus === 1
  const isOld = created instanceof Date && created < cutoff
  // 只刪除：已取貨完成（灰底） 且 超過一個月
  return isDone && isOld
}

async function calculatePickups() {
  const result = $('#result-pickups')
  const cutoff = pickupCutoffDate()
  appendLog(`🛒 櫃檯取貨：計算 pinStatus=1 且早於 ${cutoff.toISOString().slice(0, 10)} 的紀錄`)

  if (result) result.textContent = '計算中…'

  try {
    const snap = await getDocs(collection(db, PICKUP_COLLECTION))
    const total = snap.size
    let deletable = 0

    snap.forEach(d => {
      if (pickupIsDeletable(d.data(), cutoff)) deletable++
    })

    if (result) result.textContent = `${deletable} / ${total}`
    appendLog(`✅ 櫃檯取貨計算完成：可刪 ${deletable} / 總筆數 ${total}`, 'success')
  } catch (e) {
    if (result) result.textContent = '計算失敗'
    appendLog(`❌ 櫃檯取貨錯誤：${e.message}`, 'error')
  }
}

async function cleanPickups() {
  const cutoff = pickupCutoffDate()
  const cutoffStr = cutoff.toISOString().slice(0, 10)
  const ok = confirm(
    `將刪除 ${PICKUP_COLLECTION} 中「已取貨完成（pinStatus = 1，灰底）」且 ${cutoffStr} 以前的紀錄，未完成取貨一律保留。此動作無法復原，確定？`
  )
  if (!ok) return

  const result = $('#result-pickups')
  if (result) result.textContent = '清理中…'
  appendLog('🧹 開始清理櫃檯取貨舊資料…')

  try {
    const snap = await getDocs(collection(db, PICKUP_COLLECTION))
    const total = snap.size
    let deleted = 0

    for (const d of snap.docs) {
      if (pickupIsDeletable(d.data(), cutoff)) {
        await deleteDoc(doc(db, PICKUP_COLLECTION, d.id))
        deleted++
      }
    }

    if (result) result.textContent = `已刪除 ${deleted} / 原總數 ${total}`
    appendLog(`✅ 櫃檯取貨清理完成：刪除 ${deleted} 筆`, 'success')
  } catch (e) {
    if (result) result.textContent = '清理失敗'
    appendLog(`❌ 櫃檯取貨清理錯誤：${e.message}`, 'error')
  }
}

/* ---------- 初始化 ---------- */

window.onload = () => {
  $('#btn-calc-bulletins')?.addEventListener('click', calculateBulletins)
  $('#btn-clean-bulletins')?.addEventListener('click', cleanBulletins)

  $('#btn-calc-daily')?.addEventListener('click', calculateDaily)
  $('#btn-clean-daily')?.addEventListener('click', cleanDaily)

  $('#btn-calc-pickups')?.addEventListener('click', calculatePickups)
  $('#btn-clean-pickups')?.addEventListener('click', cleanPickups)

  $('#clear-log')?.addEventListener('click', () => {
    const area = logArea()
    if (area) area.innerHTML = ''
  })

  appendLog('🧹 資料庫清理工具已載入，請選擇模組並先按「計算」。')
}
