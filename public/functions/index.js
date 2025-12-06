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
const SMILEPAY_ISSUE_URL = 'https://ssl.smse.com.tw/api/SPEinvoice_Storage.asp'
const SMILEPAY_VOID_URL  = 'https://ssl.smse.com.tw/api/SPEinvoice_Invalid.asp'
const SMILEPAY_QUERY_URL = 'https://ssl.smse.com.tw/api/SPEinvoice_Query.asp'

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
      donateMark, donateCode
    } = req.body || {}

    // 簡單檢查
    if (!companyId || !items || !items.length || !amount) {
      res.status(400).json({ success: false, message: '缺少必要欄位' })
      return
    }

    const company = await getCompanyConfig(companyId)

    // === 日期 / 時間：依 SmilePay 規格 ===
    // InvoiceDate：YYYYMMDD 例如 20251207
    // InvoiceTime：HHMMSS   例如 143522
    const now = new Date()
    const y  = now.getFullYear()
    const m  = String(now.getMonth() + 1).padStart(2, '0')
    const d  = String(now.getDate()).padStart(2, '0')
    const hh = String(now.getHours()).padStart(2, '0')
    const mm = String(now.getMinutes()).padStart(2, '0')
    const ss = String(now.getSeconds()).padStart(2, '0')

    const invoiceDate = `${y}${m}${d}`
    const invoiceTime = `${hh}${mm}${ss}`

    // === 品項陣列 ===
    const itemNames  = items.map(i => i.name)
    const itemCounts = items.map(i => i.qty)
    const itemPrices = items.map(i => i.price)
    const itemAmts   = items.map(i => i.amount)

    const params = new URLSearchParams()

    // 商家認證
    params.append('Grvc', company.grvc)          // 例：SEI1001326
    params.append('Verify_key', company.verifyKey)

    // ====== 稅率類型 Intype / TaxType（這次錯誤的主角）======
    // 一般 5% 應稅（含稅金額）：
    //   Intype = "07"
    //   TaxType = "1"
    //
    // 速買配的 EInvoice 文件裡，沒有填或填錯就會回傳「稅率類型(Intype)錯誤」
    params.append('Intype', '07')
    params.append('TaxType', '1')

    // 發票基本資料
    params.append('InvoiceDate', invoiceDate)        // YYYYMMDD
    params.append('InvoiceTime', invoiceTime)        // HHMMSS
    params.append('BuyerName', buyerTitle || '')     // 買受人名稱
    params.append('Buyer_Identifier', buyerGUI || '')// 統編（若無就空字串）
    params.append('Amount', String(amount))          // 含稅總額
    params.append('SalesAmount', String(amount))     // 銷售額（暫時同 total）
    params.append('Remark', orderId || '')           // 我們拿來放訂單編號

    // 捐贈
    params.append('DonateMark', donateMark || '0')
    if (donateMark === '1' && donateCode) {
      params.append('LoveCode', donateCode)
    }

    // 載具：手機條碼 / 自然人憑證…等
    if (carrierType && carrierType !== 'NONE' && carrierValue) {
      // 根據 SmilePay 文件：手機條碼 3J0002，自然人憑證 CQ0001
      params.append('CarrierType', carrierType === 'MOBILE' ? '3J0002' : 'CQ0001')
      params.append('CarrierId1', carrierValue)
    }

    // 品項
    itemNames.forEach(n  => params.append('InvoiceItemName[]',   n))
    itemCounts.forEach(c => params.append('InvoiceItemCount[]',  String(c)))
    itemPrices.forEach(p => params.append('InvoiceItemPrice[]',  String(p)))
    itemAmts.forEach(a   => params.append('InvoiceItemAmount[]', String(a)))

    // 呼叫 SmilePay EInvoice API
    const spRes = await fetch(SMILEPAY_ISSUE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params
    })
    const text = await spRes.text()

    // 解析他們回傳的 XML
    const invoiceNumber = /<InvoiceNumber>(.*?)<\/InvoiceNumber>/i.exec(text)?.[1] || ''
    const randomNumber  = /<RandomNumber>(.*?)<\/RandomNumber>/i.exec(text)?.[1] || ''
    const status        = /<Status>(.*?)<\/Status>/i.exec(text)?.[1] || ''
    const desc          = /<Desc>(.*?)<\/Desc>/i.exec(text)?.[1] || ''

    if (status !== 'Success' && status !== 'Successed') {
      // 這裡會把他們原始 XML 打包回去 raw，方便你 debug
      res.json({ success: false, message: desc || 'SmilePay 回傳失敗', raw: text })
      return
    }

    // 成功就寫一筆到 Firestore
    const docRef = await db.collection('invoices').add({
      companyId,
      companyName: company.name,
      orderId,
      buyerGUI,
      buyerTitle,
      contactName,
      contactPhone,
      contactEmail,
      amount,
      items,
      carrierType,
      carrierValue,
      donateMark,
      donateCode,
      status: 'ISSUED',
      invoiceNumber,
      randomNumber,
      invoiceDate,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      smilepayRaw: { xml: text }
    })

    res.json({
      success: true,
      id: docRef.id,
      invoiceNumber,
      randomNumber,
      invoiceDate
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: err.message })
  }
})

// ========== 作廢發票 ==========
exports.voidInvoice = functions.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*')
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.set('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') {
    res.status(204).send('')
    return
  }

  try {
    const { companyId, invoiceNumber, reason } = req.body || {}
    if (!companyId || !invoiceNumber) {
      res.status(400).json({ success: false, message: '缺少 companyId 或 invoiceNumber' })
      return
    }
    const company = await getCompanyConfig(companyId)

    const params = new URLSearchParams()
    params.append('Grvc', company.grvc)
    params.append('Verify_key', company.verifyKey)
    params.append('InvoiceNumber', invoiceNumber)
    params.append('Reason', reason || '發票作廢')

    const spRes = await fetch(SMILEPAY_VOID_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params
    })
    const text = await spRes.text()

    const status = /<Status>(.*?)<\/Status>/i.exec(text)?.[1] || ''
    const desc   = /<Desc>(.*?)<\/Desc>/i.exec(text)?.[1] || ''

    if (status !== 'Success' && status !== 'Successed') {
      res.json({ success: false, message: desc || 'SmilePay 作廢失敗', raw: text })
      return
    }

    // 更新該發票紀錄狀態
    const snap = await db.collection('invoices')
      .where('companyId', '==', companyId)
      .where('invoiceNumber', '==', invoiceNumber)
      .limit(1).get()

    if (!snap.empty) {
      const docRef = snap.docs[0].ref
      await docRef.update({
        status: 'VOIDED',
        voidReason: reason || '',
        voidAt: admin.firestore.FieldValue.serverTimestamp(),
        voidRaw: text
      })
    }

    res.json({ success: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: err.message })
  }
})

// ========== 查詢發票 ==========
exports.queryInvoice = functions.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*')
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.set('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') {
    res.status(204).send('')
    return
  }

  try {
    const { companyId, invoiceNumber } = req.body || {}
    if (!companyId || !invoiceNumber) {
      res.status(400).json({ success: false, message: '缺少 companyId 或 invoiceNumber' })
      return
    }

    const company = await getCompanyConfig(companyId)
    const params = new URLSearchParams()
    params.append('Grvc', company.grvc)
    params.append('Verify_key', company.verifyKey)
    params.append('InvoiceNumber', invoiceNumber)

    const spRes = await fetch(SMILEPAY_QUERY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params
    })
    const text = await spRes.text()

    const status    = /<Status>(.*?)<\/Status>/i.exec(text)?.[1] || ''
    const desc      = /<Desc>(.*?)<\/Desc>/i.exec(text)?.[1] || ''
    const invStatus = /<InvoiceStatus>(.*?)<\/InvoiceStatus>/i.exec(text)?.[1] || ''

    res.json({
      success: true,
      status,
      statusText: desc,
      invoiceStatus: invStatus,
      raw: text
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: err.message })
  }
})
