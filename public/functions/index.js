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
    // InvoiceDate : YYYY/MM/DD  例如 2025/12/07
    // InvoiceTime : HH:MM:SS    例如 14:35:22
    const now = new Date()
    const y  = now.getFullYear()
    const m  = String(now.getMonth() + 1).padStart(2, '0')
    const d  = String(now.getDate()).padStart(2, '0')
    const hh = String(now.getHours()).padStart(2, '0')
    const mm = String(now.getMinutes()).padStart(2, '0')
    const ss = String(now.getSeconds()).padStart(2, '0')

    // ✅ 注意：要有斜線與冒號
    const invoiceDate = `${y}/${m}/${d}`    // 例如 2025/12/07
    const invoiceTime = `${hh}:${mm}:${ss}` // 例如 14:35:22

    // === 品項陣列 ===
    // === 重新整理品項，確保數量 / 單價 / 小計 都正確 ===
    const normalizedItems = (items || []).map(it => {
      const qty   = Number(it.qty)   || 0
      const price = Number(it.price) || 0
      const amount = qty * price     // 🔸 各明細總額 = 數量 * 單價
      return {
        name: String(it.name || ''),
        qty,
        price,
        amount
      }
    }).filter(it => it.name && it.qty > 0)

    if (!normalizedItems.length) {
      res.status(400).json({ success: false, message: '至少需要一筆有效商品明細' })
      return
    }

    // 🔸 重新算一遍總金額，避免跟 POS 傳來的 amount 有落差
    const totalAmount = normalizedItems.reduce((sum, it) => sum + it.amount, 0)

    // === 品項陣列 ===
    const itemNames   = normalizedItems.map(i => i.name)
    const itemCounts  = normalizedItems.map(i => i.qty)
    const itemPrices  = normalizedItems.map(i => i.price)
    const itemAmts    = normalizedItems.map(i => i.amount)

    const params = new URLSearchParams()

    // 商家認證
    params.append('Grvc', company.grvc)
    params.append('Verify_key', company.verifyKey)

    // 稅率類型：一般 5% 應稅（含稅金額）
    params.append('Intype', '07')
    params.append('TaxType', '1')

    // 發票基本資料（這裡用重新計算的 totalAmount）
    params.append('InvoiceDate', invoiceDate)           // YYYY/MM/DD
    params.append('InvoiceTime', invoiceTime)           // HH:MM:SS
    params.append('BuyerName', buyerTitle || '')
    params.append('Buyer_Identifier', buyerGUI || '')
    params.append('Amount', String(totalAmount))        // 總金額（含稅）
    params.append('AllAmount', String(totalAmount))     // 文件裡的「總金額(含稅)」
    params.append('SalesAmount', String(totalAmount))   // 銷售額
    params.append('Remark', orderId || '')

    // 捐贈
    params.append('DonateMark', donateMark || '0')
    if (donateMark === '1' && donateCode) {
      params.append('LoveCode', donateCode)
    }

    // 載具：手機條碼 / 自然人憑證等
    if (carrierType && carrierType !== 'NONE' && carrierValue) {
      params.append('CarrierType', carrierType === 'MOBILE' ? '3J0002' : 'CQ0001')
      params.append('CarrierId1', carrierValue)
    }

    // === 明細欄位：長度一定完全一樣 ===
    itemNames.forEach(n  => params.append('InvoiceItemName[]',   n))
    itemCounts.forEach(c => params.append('InvoiceItemCount[]',  String(c)))
    itemPrices.forEach(p => params.append('InvoiceItemPrice[]',  String(p)))

    // 🔸 明細金額（各項目）— 對應文件的 Amount（各明細總額）
    itemAmts.forEach(a   => {
      params.append('InvoiceItemAmount[]', String(a))  // 有些範例用這個名稱
      params.append('Amount[]',             String(a))  // 文件欄位名是 Amount
    })

    // 🔸 商品稅率型態：全部 1 = 應稅
    normalizedItems.forEach(() => {
      params.append('ProductTaxType[]', '1')
    })


    // 商家認證
    params.append('Grvc', company.grvc)          // 例：SEI1001326
    params.append('Verify_key', company.verifyKey)

    // ====== 稅率類型 Intype / TaxType ======
    // 一般 5% 應稅（含稅金額）：
    //   Intype = "07"
    //   TaxType = "1"
    params.append('Intype', '07')
    params.append('TaxType', '1')

    // 發票基本資料
    params.append('InvoiceDate', invoiceDate)          // YYYY/MM/DD
    params.append('InvoiceTime', invoiceTime)          // HH:MM:SS
    params.append('BuyerName', buyerTitle || '')       // 買受人名稱
    params.append('Buyer_Identifier', buyerGUI || '')  // 統編（若無就空字串）

    // ✅ 金額相關（全部用明細加總）
    params.append('Amount', String(totalForSmile))       // 舊欄位，含稅總額
    params.append('AllAmount', String(totalForSmile))    // 總金額(含稅)
    params.append('SalesAmount', String(totalForSmile))  // 銷售額

    // 單價是否含稅：我們 POS 的單價是「含稅價」
    params.append('UnitTAX', 'Y')

    // 目前先當 B2C 含稅，稅額讓 SmilePay 自己算，這裡先填 0
    params.append('TaxAmount', '0')

    params.append('Remark', orderId || '')              // 我們拿來放訂單編號

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



