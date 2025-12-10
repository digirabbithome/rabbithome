// === Rabbithome x SmilePay 電子發票 Cloud Functions v2025-12-07 ===
const functions = require('firebase-functions/v2/https')
const admin = require('firebase-admin')
const fetch = require('node-fetch')
const { URLSearchParams } = require('url')

if (!admin.apps.length) {
  admin.initializeApp()
}
const db = admin.firestore()

// ⚠️ 使用新版 EInvoice API 路徑（文件寫的那一組 SPEinvoice_xxx.asp）
const SMILEPAY_ISSUE_URL  = 'https://ssl.smse.com.tw/api/SPEinvoice_Storage.asp'
// 改用 Modify 這條來作廢 / 註銷
const SMILEPAY_MODIFY_URL = 'https://ssl.smse.com.tw/api/SPEinvoice_Storage_Modify.asp'
const SMILEPAY_QUERY_URL  = 'https://ssl.smse.com.tw/api/SPEinvoice_Query.asp'

// 從 Firestore invoice-config/{companyId} 讀取各家公司的 Grvc / Verify_key / name
async function getCompanyConfig(companyId) {
  const snap = await db.collection('invoice-config').doc(companyId).get()
  if (!snap.exists) throw new Error(`invoice-config/${companyId} 不存在`)
  return snap.data()
}

// ========== 開立發票 ==========
exports.createInvoice = functions.onRequest(async (req, res) => {
  // CORS
  res.set('Access-Control-Allow-Origin', '*')
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.set('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') {
    res.status(204).send('')
    return
  }

  try {
    const {
      companyId, orderId,
      buyerGUI, buyerTitle,
      contactName, contactPhone, contactEmail,
      amount, items,
      carrierType, carrierValue,
      donateMark, donateCode,
      preInvoice, unpaid,
      createdByNickname        // ⭐ 前端傳來的登入暱稱
    } = req.body || {}

    // 簡單檢查
    if (!companyId || !items || !items.length) {
      res.status(400).json({ success: false, message: '缺少必要欄位（companyId 或 items）' })
      return
    }

    const company = await getCompanyConfig(companyId)

    // === 日期 / 時間：用台北時間（Asia/Taipei） ===
    const now = new Date()
    // 轉成台北時間的 Date 物件
    const tpeNow = new Date(
      now.toLocaleString('en-US', { timeZone: 'Asia/Taipei' })
    )

    const y  = tpeNow.getFullYear()
    const m  = String(tpeNow.getMonth() + 1).padStart(2, '0')
    const d  = String(tpeNow.getDate()).padStart(2, '0')
    const hh = String(tpeNow.getHours()).toString().padStart(2, '0')
    const mm = String(tpeNow.getMinutes()).toString().padStart(2, '0')
    const ss = String(tpeNow.getSeconds()).toString().padStart(2, '0')

    const invoiceDate = `${y}/${m}/${d}`      // 例如 2025/12/07
    const invoiceTime = `${hh}:${mm}:${ss}`   // 例如 01:33:06

    // === 整理品項：過濾掉空行，並算出每一筆小計 ===
    const normalizedItems = (items || []).map(it => {
      const qty   = Number(it.qty)   || 0
      const price = Number(it.price) || 0
      const lineAmt = qty * price
      return {
        name: String(it.name || '').trim(),
        qty,
        price
