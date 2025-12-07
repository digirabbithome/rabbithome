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
const SMILEPAY_ISSUE_URL = 'https://ssl.smse.com.tw/api_test/SPEinvoice_Storage.asp'
const SMILEPAY_VOID_URL  = 'https://ssl.smse.com.tw/api/SPEinvoice_Invalid.asp'
const SMILEPAY_QUERY_URL = 'https://ssl.smse.com.tw/api/SPEinvoice_Query.asp'

// 從 Firestore invoice-config/{companyId} 讀取各家公司的 Grvc / Verify_key / name
async function getCompanyConfig(companyId) {
  const snap = await db.collection('invoice-config').doc(companyId).get()
  if (!snap.exists) throw new Error(`invoice-config/${companyId} 不存在`)
  return snap.data()
}

// ========== 開立發票 ==========
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
const hh = String(tpeNow.getHours()).padStart(2, '0')
const mm = String(tpeNow.getMinutes()).padStart(2, '0')
const ss = String(tpeNow.getSeconds()).padStart(2, '0')

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
        price,
        amount: lineAmt
      }
    }).filter(it => it.name && it.qty > 0)

    if (!normalizedItems.length) {
      res.status(400).json({ success: false, message: '至少需要一筆有效商品明細' })
      return
    }

    // 重新計算總金額，避免跟前端 amount 不一致
    const totalAmount = normalizedItems.reduce((sum, it) => sum + it.amount, 0)

    // === 依 SmilePay 規格組四個「|」分隔的欄位 ===
    const descStr  = normalizedItems
      .map(it => it.name.replace(/\|/g, '、'))          // 避免品名裡自己有「|」
      .join('|')
    const qtyStr   = normalizedItems.map(it => String(it.qty)).join('|')
    const priceStr = normalizedItems.map(it => String(it.price)).join('|')
    const amtStr   = normalizedItems.map(it => String(it.amount)).join('|')  // 🔸 各項目金額

    const params = new URLSearchParams()

    // === 商家認證 ===
    params.append('Grvc', company.grvc)
    params.append('Verify_key', company.verifyKey)

    // === 稅率類型：一般 5% 應稅（含稅金額） ===
    params.append('Intype', '07')
    params.append('TaxType', '1')

    // === 發票基本資料 ===
    params.append('InvoiceDate', invoiceDate)
    params.append('InvoiceTime', invoiceTime)
    params.append('BuyerName', buyerTitle || '')
    params.append('Buyer_Identifier', buyerGUI || '')

    // ✅ 金額相關（全部用重新計算的 totalAmount）
    // 文件裡的說明是：
    // Amount：各項目總額（用 | 分隔）
    // AllAmount / SalesAmount：總金額
    params.append('AllAmount', String(totalAmount))    // 總金額(含稅)
    params.append('SalesAmount', String(totalAmount))  // 銷售額
    params.append('TotalAmount', String(totalAmount))  // 若文件有這個欄位就一起給
    // 給 SmilePay 當「含稅總額」，有些範例是這樣叫
    params.append('Amt', String(totalAmount))

    // 單價是否含稅：我們 POS 單價是含稅價
    params.append('UnitTAX', 'Y')
    params.append('TaxAmount', '0') // 讓 SmilePay 自己算稅額即可

    params.append('Remark', orderId || '')

    // === 捐贈 ===
    params.append('DonateMark', donateMark || '0')
    if (donateMark === '1' && donateCode) {
      params.append('LoveCode', donateCode)
    }

    // === 載具 ===
    if (carrierType && carrierType !== 'NONE' && carrierValue) {
      // 文件：手機條碼 3J0002，自然人憑證 CQ0001
      params.append('CarrierType', carrierType === 'MOBILE' ? '3J0002' : 'CQ0001')
      params.append('CarrierId1', carrierValue)
    }

    // === 商品明細（四個「|」字串）===
    params.append('Description', descStr)
    params.append('Quantity', qtyStr)
    params.append('UnitPrice', priceStr)
    params.append('Amount', amtStr)   // 🔸 各明細總額（最關鍵，一定要 = qty*price）

    // ⭐ 在這裡印出完整 payload，方便你在 Logs 看到
    console.log('[SmilePay Payload]', params.toString())

    // === 呼叫 SmilePay EInvoice API ===
    const spRes = await fetch(SMILEPAY_ISSUE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params
    })
    const text = await spRes.text()

    // 解析 XML
    const invoiceNumber = /<InvoiceNumber>(.*?)<\/InvoiceNumber>/i.exec(text)?.[1] || ''
    const randomNumber  = /<RandomNumber>(.*?)<\/RandomNumber>/i.exec(text)?.[1] || ''
    const status        = /<Status>(.*?)<\/Status>/i.exec(text)?.[1] || ''
    const desc          = /<Desc>(.*?)<\/Desc>/i.exec(text)?.[1] || ''

  const okStatuses = ['0', '0000', 'Success', 'Successed', 'Succeeded']

if (!okStatuses.includes(status)) {
  res.json({ success: false, message: desc || status || 'SmilePay 回傳失敗', raw: text })
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
      amount: totalAmount,           // 這裡也統一用重新計算的
      items: normalizedItems,
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



