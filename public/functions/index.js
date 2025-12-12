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
      companyId,
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
      preInvoice,
      unpaid,
      createdByNickname
    } = req.body || {}

    if (!companyId || !items || !items.length) {
      res.status(400).json({ success: false, message: '缺少必要欄位（companyId 或 items）' })
      return
    }

    const company = await getCompanyConfig(companyId)

    // === 日期 / 時間：台北時區 ===
    const now = new Date()
    const tpeNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Taipei' }))

    const y  = tpeNow.getFullYear()
    const m  = String(tpeNow.getMonth() + 1).padStart(2, '0')
    const d  = String(tpeNow.getDate()).padStart(2, '0')
    const hh = String(tpeNow.getHours()).padStart(2, '0')
    const mm = String(tpeNow.getMinutes()).padStart(2, '0')
    const ss = String(tpeNow.getSeconds()).padStart(2, '0')

    const invoiceDate = `${y}/${m}/${d}`
    const invoiceTime = `${hh}:${mm}:${ss}`

    // === 整理品項 ===
    const normalizedItems = (items || []).map(it => {
      const qty = Number(it.qty) || 0
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

    // 以明細加總為準（忽略前端傳進來的 amount，避免不一致）
    const totalAmount = normalizedItems.reduce((sum, it) => sum + (Number(it.amount) || 0), 0)
    const gross = Math.round(Number(totalAmount) || 0)

    // === SmilePay 明細欄位（7 欄筆數要一致）===
    const descStr = normalizedItems
      .map(it => it.name.replace(/\|/g, '、')) // 名稱不能含 |
      .join('|')

    const qtyStr = normalizedItems.map(it => String(it.qty)).join('|')
    const priceStr = normalizedItems.map(it => String(it.price)).join('|')
    const amtStr = normalizedItems.map(it => String(it.amount)).join('|')

    // Unit：用英文縮寫
    const unitStr = normalizedItems.map(() => 'pcs').join('|')

    // ProductTaxType：先固定 1（應稅）
    // 若你要做免稅/零稅率，這裡再依據 UI 改成 2/3
    const productTaxTypeStr = normalizedItems.map(() => '1').join('|')

    // 商品備註：每項都要佔位
    const itemRemarkStr = normalizedItems.map(() => '').join('|')

    // ✅ 保險：七個欄位筆數一致
    const counts = [
      descStr.split('|').length,
      qtyStr.split('|').length,
      priceStr.split('|').length,
      amtStr.split('|').length,
      unitStr.split('|').length,
      productTaxTypeStr.split('|').length,
      itemRemarkStr.split('|').length
    ]
    const allSame = counts.every(c => c === counts[0])
    if (!allSame) {
      throw new Error(
        '商品各項目數量不符（本機檢查）：' +
        `Desc=${counts[0]}, Qty=${counts[1]}, Price=${counts[2]}, Amount=${counts[3]}, ` +
        `Unit=${counts[4]}, ProductTaxType=${counts[5]}, Remark=${counts[6]}`
      )
    }

    // === 組參數 ===
    const params = new URLSearchParams()

    // 商家認證
    params.append('Grvc', company.grvc)
    params.append('Verify_key', company.verifyKey)

    // 交易類型 & 課稅別（⚠️ 只送一次 TaxType）
    params.append('Intype', '07')
    params.append('TaxType', '1') // 1=應稅

    // 發票日期時間
    params.append('InvoiceDate', invoiceDate)
    params.append('InvoiceTime', invoiceTime)

    // 買受人資訊
    if (buyerGUI) {
      // B2B
      params.append('Buyer_id', buyerGUI)
      params.append('CompanyName', buyerTitle || '')
    } else {
      // B2C
      params.append('Buyer_id', '')
      params.append('CompanyName', '')
      params.append('Name', buyerTitle || contactName || '')
    }

    if (contactPhone) params.append('Phone', contactPhone)
    if (contactEmail) params.append('Email', contactEmail)

    // 金額（用含稅總額；單價含稅）
    params.append('UnitTAX', 'Y')             // ✅ 單價含稅（避免你目前 UI/Excel/SIMPOS 都是含稅價格時不一致）
    params.append('AllAmount', String(gross)) // 含稅總額

    // 這兩個你原本就有傳，保留（避免某些情境 SmilePay 需要）
    params.append('TotalAmount', String(gross))
    params.append('Amt', String(gross))

    // 訂單/自訂識別
    // ⚠️ 不要再用 params.append('Remark', orderId) 了，因為商品明細也要用 Remark（會重複 key）
    params.append('orderid', orderId || '')
    params.append('data_id', orderId || '')

    // 捐贈
    params.append('DonateMark', donateMark || '0')
    if ((donateMark || '0') === '1' && donateCode) {
      params.append('LoveCode', donateCode)
    }

    // 載具
    if (carrierType && carrierType !== 'NONE' && carrierValue) {
      params.append('CarrierType', carrierType === 'MOBILE' ? '3J0002' : 'CQ0001')
      params.append('CarrierID', carrierValue)
    }

    // 商品明細（照 SmilePay 欄位）
    params.append('Description', descStr)
    params.append('Quantity', qtyStr)
    params.append('UnitPrice', priceStr)
    params.append('Unit', unitStr)
    params.append('ProductTaxType', productTaxTypeStr)
    params.append('Remark', itemRemarkStr) // ✅ 這裡保留作「商品備註」
    params.append('Amount', amtStr)

    console.log('[SmilePay Payload]', params.toString())

    // === 呼叫 SmilePay ===
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

    const okStatuses = ['0', '0000', 'Success', 'Successed', 'Succeeded']
    if (!okStatuses.includes(status)) {
      res.json({ success: false, message: desc || status || 'SmilePay 回傳失敗', raw: text })
      return
    }

    // === 成功：寫 Firestore ===
    const docRef = await db.collection('invoices').add({
      companyId,
      companyName: company.name,
      orderId,
      buyerGUI,
      buyerTitle,
      contactName,
      contactPhone,
      contactEmail,
      amount: gross,
      items: normalizedItems,
      carrierType,
      carrierValue,
      donateMark,
      donateCode,

      preInvoice: !!preInvoice,
      unpaid: !!(preInvoice || unpaid),
      createdByNickname: createdByNickname || null,

      // 你之後若要列印「銷售額(應稅)/稅額/總計」可以用 gross 回推
      // taxType: '1',

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
// ========== 作廢發票（使用 SPEinvoice_Storage_Modify.asp + types=Cancel） ==========
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

    // 先從 Firestore 找這張發票，拿到 InvoiceDate
    const snap = await db.collection('invoices')
      .where('companyId', '==', companyId)
      .where('invoiceNumber', '==', invoiceNumber)
      .limit(1)
      .get()

    if (snap.empty) {
      res.json({ success: false, message: 'Firestore 中查無該發票，無法作廢' })
      return
    }

    const invDoc = snap.docs[0]
    const invData = invDoc.data()

    let invoiceDate = invData.invoiceDate
    if (!invoiceDate) {
      res.json({ success: false, message: '發票日期缺失（invoiceDate），無法作廢' })
      return
    }
    // 文件格式用 2025/12/10，如有 "-" 就轉一下
    invoiceDate = invoiceDate.replace(/-/g, '/')

    const cancelReason = (reason || '發票作廢').slice(0, 20)
    const remark = (`Rabbithome void ${invoiceNumber}`).slice(0, 200)

    const params = new URLSearchParams()
    params.append('Grvc', company.grvc)
    params.append('Verify_key', company.verifyKey)
    params.append('InvoiceNumber', invoiceNumber)
    params.append('InvoiceDate', invoiceDate)
    params.append('types', 'Cancel')            // ⭐ 關鍵：作廢發票
    params.append('CancelReason', cancelReason) // ⭐ 文件要求的欄位名
    params.append('Remark', remark)

    console.log('[SmilePay VOID payload]', params.toString())

    const spRes = await fetch(SMILEPAY_MODIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params
    })
    const text = await spRes.text()
    console.log('[SmilePay VOID response]', text)

    const statusMatch = /<Status>(-?\d+)<\/Status>/i.exec(text)
    const descMatch   = /<Desc>(.*?)<\/Desc>/i.exec(text)

    const status = statusMatch ? statusMatch[1] : ''
    const desc   = descMatch ? descMatch[1] : ''

    // 依文件：Status > 0 表成功，或你可以照實測來調整
    const successCodes = ['1', '0', '0000', 'Success', 'Successed', 'Succeeded']

    if (!successCodes.includes(status)) {
      res.json({
        success: false,
        message: `SmilePay 作廢失敗（${status}）：${desc || '無詳細訊息'}`,
        raw: text
      })
      return
    }

    // ✅ SmilePay 作廢成功 → 更新 Firestore
    await invDoc.ref.update({
      status: 'VOIDED',
      voidReason: cancelReason,
      voidDesc: desc,
      voidAt: admin.firestore.FieldValue.serverTimestamp(),
      voidRaw: text
    })

    res.json({ success: true, message: desc || '作廢成功' })
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


