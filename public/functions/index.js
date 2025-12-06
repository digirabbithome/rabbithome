const functions = require('firebase-functions/v2/https')
const admin = require('firebase-admin')
const fetch = require('node-fetch')
const { URLSearchParams } = require('url')

if (!admin.apps.length) {
  admin.initializeApp()
}
const db = admin.firestore()

// === SmilePay 電子發票 API URL ===
const SMILEPAY_ISSUE_URL = 'https://ssl.smse.com.tw/api/SPEinvoice_Storage.asp'
const SMILEPAY_VOID_URL  = 'https://ssl.smse.com.tw/api/SPEinvoice_Invalid.asp'
const SMILEPAY_QUERY_URL = 'https://ssl.smse.com.tw/api/SPEinvoice_Query.asp'

// 讀取每家公司的發票設定（invoice-config/{companyId}）
async function getCompanyConfig(companyId) {
  const snap = await db.collection('invoice-config').doc(companyId).get()
  if (!snap.exists) throw new Error(`invoice-config/${companyId} 不存在`)
  return snap.data()
}

// === 開立發票 ===
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

    if (!companyId || !items || !items.length || !amount) {
      res.status(400).json({ success: false, message: '缺少必要欄位' })
      return
    }

    const company = await getCompanyConfig(companyId)

    // === 日期時間：SmilePay 需要 YYYY/MM/DD + HH:MM:SS ===
    const now = new Date()

    const y  = now.getFullYear()
    const m  = String(now.getMonth() + 1).padStart(2, '0')
    const d  = String(now.getDate()).padStart(2, '0')
    const hh = String(now.getHours()).padStart(2, '0')
    const mi = String(now.getMinutes()).padStart(2, '0')
    const ss = String(now.getSeconds()).padStart(2, '0')

    const invoiceDate = `${y}/${m}/${d}`      // 例如 2025/12/07
    const invoiceTime = `${hh}:${mi}:${ss}`   // 例如 14:42:22

    // 商品資訊
    const itemNames  = items.map(i => i.name)
    const itemCounts = items.map(i => i.qty)
    const itemPrices = items.map(i => i.price)
    const itemAmts   = items.map(i => i.amount)

    // 參數組裝
    const params = new URLSearchParams()

    const grvc      = (company.grvc || '').trim()
    const verifyKey = (company.verifyKey || '').trim()

    params.append('Grvc', grvc)
    params.append('Verify_key', verifyKey)

    params.append('InvoiceDate', invoiceDate)
    params.append('InvoiceTime', invoiceTime)

    params.append('BuyerName', buyerTitle || '')
    params.append('Buyer_Identifier', buyerGUI || '')
    params.append('Amount', String(amount))
    params.append('SalesAmount', String(amount))
    params.append('Remark', orderId || '')

    // 捐贈
    params.append('DonateMark', donateMark || '0')
    if (donateMark === '1' && donateCode) {
      params.append('LoveCode', donateCode)
    }

    // 載具
    if (carrierType && carrierType !== 'NONE' && carrierValue) {
      // 3J0002：手機條碼；CQ0001：自然人憑證（依 SmilePay 規格）
      params.append('CarrierType', carrierType === 'MOBILE' ? '3J0002' : 'CQ0001')
      params.append('CarrierId1', carrierValue)
    }

    // 商品陣列（SmilePay 用 [] 當多筆欄位）
    itemNames.forEach(n => params.append('InvoiceItemName[]', n))
    itemCounts.forEach(c => params.append('InvoiceItemCount[]', String(c)))
    itemPrices.forEach(p => params.append('InvoiceItemPrice[]', String(p)))
    itemAmts.forEach(a => params.append('InvoiceItemAmount[]', String(a)))

    // Debug 用：可以在 Logs 看看實際送出的日期時間
    console.log('SmilePay createInvoice params:', {
      Grvc: grvc,
      InvoiceDate: invoiceDate,
      InvoiceTime: invoiceTime,
      Amount: amount
    })

    const spRes = await fetch(SMILEPAY_ISSUE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params
    })
    const text = await spRes.text()

    const invoiceNumber = /<InvoiceNumber>(.*?)<\/InvoiceNumber>/i.exec(text)?.[1] || ''
    const randomNumber  = /<RandomNumber>(.*?)<\/RandomNumber>/i.exec(text)?.[1] || ''
    const status        = /<Status>(.*?)<\/Status>/i.exec(text)?.[1] || ''
    const desc          = /<Desc>(.*?)<\/Desc>/i.exec(text)?.[1] || ''

    if (status !== 'Success' && status !== 'Successed') {
      console.error('SmilePay createInvoice error:', text)
      res.json({ success: false, message: desc || 'SmilePay 回傳失敗', raw: text })
      return
    }

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

// === 作廢發票 ===
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

    const grvc      = (company.grvc || '').trim()
    const verifyKey = (company.verifyKey || '').trim()

    const params = new URLSearchParams()
    params.append('Grvc', grvc)
    params.append('Verify_key', verifyKey)
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
      console.error('SmilePay voidInvoice error:', text)
      res.json({ success: false, message: desc || 'SmilePay 作廢失敗', raw: text })
      return
    }

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

// === 查詢發票 ===
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
    const grvc      = (company.grvc || '').trim()
    const verifyKey = (company.verifyKey || '').trim()

    const params = new URLSearchParams()
    params.append('Grvc', grvc)
    params.append('Verify_key', verifyKey)
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
