const functions = require('firebase-functions/v2/https')
const admin = require('firebase-admin')
const fetch = require('node-fetch')
const { URLSearchParams } = require('url')

if (!admin.apps.length) {
  admin.initializeApp()
}
const db = admin.firestore()

// TODO: 確認這三個 URL 是否與速買配文件一致
const SMILEPAY_ISSUE_URL  = 'https://ssl.smse.com.tw/api/SPInvoice_Storage.asp'
const SMILEPAY_VOID_URL   = 'https://ssl.smse.com.tw/api/SPInvoice_Invalid.asp'
const SMILEPAY_QUERY_URL  = 'https://ssl.smse.com.tw/api/SPInvoice_Query.asp'

async function getCompanyConfig(companyId) {
  const snap = await db.collection('invoice-config').doc(companyId).get()
  if (!snap.exists) throw new Error(`invoice-config/${companyId} 不存在`)
  return snap.data()
}

exports.createInvoice = functions.onRequest(async (req, res) => {
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

    const now = new Date()
    const invoiceDate = now.toISOString().slice(0, 10) // yyyy-mm-dd
    const invoiceTime = now.toTimeString().slice(0, 8) // HH:MM:SS

    const itemNames  = items.map(i => i.name)
    const itemCounts = items.map(i => i.qty)
    const itemPrices = items.map(i => i.price)
    const itemAmts   = items.map(i => i.amount)

    const params = new URLSearchParams()

    params.append('Grvc', company.grvc)
    params.append('Verify_key', company.verifyKey)

    // ⚠️ 以下欄位名稱與格式請依照速買配電子發票文件微調
    params.append('InvoiceDate', invoiceDate.replace(/-/g, ''))
    params.append('InvoiceTime', invoiceTime)
    params.append('BuyerName', buyerTitle || '')
    params.append('Buyer_Identifier', buyerGUI || '')
    params.append('Amount', String(amount))
    params.append('SalesAmount', String(amount))
    params.append('Remark', orderId || '')

    params.append('DonateMark', donateMark || '0')
    if (donateMark === '1' && donateCode) {
      params.append('LoveCode', donateCode)
    }

    if (carrierType !== 'NONE' && carrierValue) {
      params.append('CarrierType', carrierType === 'MOBILE' ? '3J0002' : 'CQ0001')
      params.append('CarrierId1', carrierValue)
    }

    itemNames.forEach(n => params.append('InvoiceItemName[]', n))
    itemCounts.forEach(c => params.append('InvoiceItemCount[]', String(c)))
    itemPrices.forEach(p => params.append('InvoiceItemPrice[]', String(p)))
    itemAmts.forEach(a => params.append('InvoiceItemAmount[]', String(a)))

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

    const status = /<Status>(.*?)<\/Status>/i.exec(text)?.[1] || ''
    const desc   = /<Desc>(.*?)<\/Desc>/i.exec(text)?.[1] || ''
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
