// === Rabbithome 資料庫清理工具 clean-db.js v6 ===
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

// 貨到通知（arrival.js 使用的集合）
const ARRIVAL_COLLECTION = 'arrival'
const ARRIVAL_KEEP_DAYS = 365 // 一年：< 365 天前全部刪除；一年內只刪已完成/已刪除

// 列印信封紀錄
const ENVELOPE_COLLECTION = 'envelopes'
const ENVELOPE_KEEP_DAYS = 90 // 僅保留最近 90 天，早於者全部刪除

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
  // 只刪除：已取貨完成（灰底） 且 超過 30 天
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

/* ---------- 貨到通知 arrival ---------- */

function arrivalCutoffDate() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - ARRIVAL_KEEP_DAYS)
  return d
}

function arrivalIsDeletable(data, cutoffYear) {
  const created = data.createdAt?.toDate?.()
  if (!(created instanceof Date)) {
    // 沒有 createdAt 的紀錄安全起見先保留
    return false
  }
  const status = data.status || '未完成'
  const deletedFlag = !!data.deleted

  // ① 一年之前的所有：無論狀態，直接刪
  if (created < cutoffYear) return true

  // ② 一年之內：只有「已完成」或「已刪除」才刪；未完成的一律保留
  if (created >= cutoffYear && (status === '已完成' || deletedFlag)) return true

  return false
}

async function calculateArrivals() {
  const result = $('#result-arrivals')
  const cutoffYear = arrivalCutoffDate()
  appendLog(`📦 貨到通知：計算 (1) 早於 ${cutoffYear.toISOString().slice(0,10)} 的所有紀錄；(2) 最近一年內已完成/已刪除的紀錄`)

  if (result) result.textContent = '計算中…'

  try {
    const snap = await getDocs(collection(db, ARRIVAL_COLLECTION))
    const total = snap.size
    let deletable = 0

    snap.forEach(d => {
      if (arrivalIsDeletable(d.data(), cutoffYear)) deletable++
    })

    if (result) result.textContent = `${deletable} / ${total}`
    appendLog(`✅ 貨到通知計算完成：可刪 ${deletable} / 總筆數 ${total}`, 'success')
  } catch (e) {
    if (result) result.textContent = '計算失敗'
    appendLog(`❌ 貨到通知錯誤：${e.message}`, 'error')
  }
}

async function cleanArrivals() {
  const cutoffYear = arrivalCutoffDate()
  const cutoffStr = cutoffYear.toISOString().slice(0, 10)
  const ok = confirm(
    `將刪除 ${ARRIVAL_COLLECTION} 中：\n1) ${cutoffStr} 以前的所有紀錄；\n2) 最近一年內「已完成」或「已刪除」的紀錄。\n「未完成」且一年內的紀錄會保留。\n此動作無法復原，確定？`
  )
  if (!ok) return

  const result = $('#result-arrivals')
  if (result) result.textContent = '清理中…'
  appendLog('🧹 開始清理貨到通知舊資料…')

  try {
    const snap = await getDocs(collection(db, ARRIVAL_COLLECTION))
    const total = snap.size
    let deleted = 0

    for (const d of snap.docs) {
      if (arrivalIsDeletable(d.data(), cutoffYear)) {
        await deleteDoc(doc(db, ARRIVAL_COLLECTION, d.id))
        deleted++
      }
    }

    if (result) result.textContent = `已刪除 ${deleted} / 原總數 ${total}`
    appendLog(`✅ 貨到通知清理完成：刪除 ${deleted} 筆`, 'success')
  } catch (e) {
    if (result) result.textContent = '清理失敗'
    appendLog(`❌ 貨到通知清理錯誤：${e.message}`, 'error')
  }
}

/* ---------- 列印信封紀錄 envelopes ---------- */

function envelopeCutoffDate() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - ENVELOPE_KEEP_DAYS)
  return d
}

function envelopeIsDeletable(data, cutoff) {
  let ts = data.timestamp
  if (ts && typeof ts.toDate === 'function') {
    ts = ts.toDate()
  } else if (ts && typeof ts === 'object' && ts.seconds) {
    ts = new Date(ts.seconds * 1000)
  }
  if (!(ts instanceof Date) || isNaN(ts.getTime())) {
    // 沒有 timestamp 的舊資料，保守起見先保留
    return false
  }
  return ts < cutoff
}

async function calculateEnvelopes() {
  const result = $('#result-envelopes')
  const cutoff = envelopeCutoffDate()
  const cutoffStr = cutoff.toISOString().slice(0, 10)
  appendLog(`📮 列印信封：計算 timestamp < ${cutoffStr} 的紀錄（僅保留最近 ${ENVELOPE_KEEP_DAYS} 天）`)

  if (result) result.textContent = '計算中…'

  try {
    const snap = await getDocs(collection(db, ENVELOPE_COLLECTION))
    const total = snap.size
    let deletable = 0

    snap.forEach(d => {
      if (envelopeIsDeletable(d.data(), cutoff)) deletable++
    })

    if (result) result.textContent = `${deletable} / ${total}`
    appendLog(`✅ 列印信封計算完成：可刪 ${deletable} / 總筆數 ${total}`, 'success')
  } catch (e) {
    if (result) result.textContent = '計算失敗'
    appendLog(`❌ 列印信封錯誤：${e.message}`, 'error')
  }
}

async function cleanEnvelopes() {
  const cutoff = envelopeCutoffDate()
  const cutoffStr = cutoff.toISOString().slice(0, 10)
  const ok = confirm(
    `將刪除 ${ENVELOPE_COLLECTION} 中 timestamp 早於 ${cutoffStr} 的所有紀錄，僅保留最近 ${ENVELOPE_KEEP_DAYS} 天。\n此動作無法復原，確定？`
  )
  if (!ok) return

  const result = $('#result-envelopes')
  if (result) result.textContent = '清理中…'
  appendLog('🧹 開始清理列印信封舊資料…')

  try {
    const snap = await getDocs(collection(db, ENVELOPE_COLLECTION))
    const total = snap.size
    let deleted = 0

    for (const d of snap.docs) {
      if (envelopeIsDeletable(d.data(), cutoff)) {
        await deleteDoc(doc(db, ENVELOPE_COLLECTION, d.id))
        deleted++
      }
    }

    if (result) result.textContent = `已刪除 ${deleted} / 原總數 ${total}`
    appendLog(`✅ 列印信封清理完成：刪除 ${deleted} 筆`, 'success')
  } catch (e) {
    if (result) result.textContent = '清理失敗'
    appendLog(`❌ 列印信封清理錯誤：${e.message}`, 'error')
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

  $('#btn-calc-arrivals')?.addEventListener('click', calculateArrivals)
  $('#btn-clean-arrivals')?.addEventListener('click', cleanArrivals)

  $('#btn-calc-envelopes')?.addEventListener('click', calculateEnvelopes)
  $('#btn-clean-envelopes')?.addEventListener('click', cleanEnvelopes)

  $('#clear-log')?.addEventListener('click', () => {
    const area = logArea()
    if (area) area.innerHTML = ''
  })

  appendLog('🧹 資料庫清理工具已載入，請選擇模組並先按「計算」。')
}
