/* invoice-preview.js — 依據發票號碼從 Firestore 讀取資料並渲染 */

import { db } from '/js/firebase.js'
import {
  collection,
  query,
  where,
  limit,
  getDocs
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'

const $ = (s, r = document) => r.querySelector(s)

window.onload = () => {
  setupButtons()
  loadAndRender()
}

function setupButtons () {
  const backBtn = $('#backBtn')
  const printBtn = $('#printBtn')

  if (backBtn) {
    backBtn.addEventListener('click', () => {
      if (window.history.length > 1) {
        window.history.back()
      } else {
        window.close()
      }
    })
  }

  if (printBtn) {
    printBtn.addEventListener('click', () => window.print())
  }
}

async function loadAndRender () {
  const params = new URLSearchParams(window.location.search)
  const invoiceNumber = params.get('invoiceNumber') || ''
  const companyId = params.get('companyId') || ''

  if (!invoiceNumber) {
    alert('缺少發票號碼參數')
    return
  }

  try {
    const col = collection(db, 'invoices')
    let q = query(col, where('invoiceNumber', '==', invoiceNumber), limit(1))
    if (companyId) {
      q = query(col,
        where('invoiceNumber', '==', invoiceNumber),
        where('companyId', '==', companyId),
        limit(1)
      )
    }

    const snap = await getDocs(q)
    if (snap.empty) {
      alert('找不到此發票資料，請確認是否已寫入 Firestore')
      return
    }

    const doc = snap.docs[0]
    const inv = { id: doc.id, ...doc.data() }
    renderInvoice(inv)
  } catch (err) {
    console.error(err)
    alert('讀取發票資料失敗')
  }
}

function renderInvoice (inv) {
  const invoiceNo = inv.invoiceNumber || ''
  const randomNumber = inv.randomNumber || '----'
  const amount = inv.amount ?? 0
  const sellerGUI = inv.sellerGUI || '48594728'
  const buyerGUI = (inv.buyerGUI || '').trim()

  // 日期 / 期別
  let d
  if (inv.invoiceDate) {
    d = new Date(inv.invoiceDate + 'T00:00:00')
  } else if (inv.createdAt?.toDate) {
    d = inv.createdAt.toDate()
  } else {
    d = new Date()
  }

  const year = d.getFullYear()
  const month = d.getMonth() + 1
  const day = d.getDate().toString().padStart(2, '0')
  const hh = d.getHours().toString().padStart(2, '0')
  const mm = d.getMinutes().toString().padStart(2, '0')
  const ss = d.getSeconds().toString().padStart(2, '0')

  const rocYear = year - 1911
  const periodStart = month % 2 === 1 ? month : month - 1
  const periodEnd = periodStart + 1
  const periodText =
    `${rocYear}年${periodStart.toString().padStart(2, '0')}` +
    `-${periodEnd.toString().padStart(2, '0')}月`

  // 套到畫面
  $('#invoiceNumber').textContent = invoiceNo
  $('#randomNumber').textContent = randomNumber
  $('#totalAmount').textContent = amount
  $('#sellerGUI').textContent = sellerGUI
  $('#periodText').textContent = periodText
  $('#datetimeText').textContent =
    `${year}-${month.toString().padStart(2, '0')}-${day} ${hh}:${mm}:${ss}`

  // 沒有買方統編就不要顯示 00000000
  const buyerEl = $('#buyerGUI')
  if (buyerGUI) {
    buyerEl.textContent = buyerGUI
  } else {
    buyerEl.textContent = '' // 保持空白即可
  }

  // 條碼內容：這裡先用「發票號碼 + 隨機碼」
  try {
    const barcodeValue = invoiceNo && randomNumber
      ? `${invoiceNo}${randomNumber}`
      : invoiceNo || ' '
    if (barcodeValue && window.JsBarcode) {
      window.JsBarcode('#barcode', barcodeValue, {
        format: 'CODE128',
        displayValue: false,
        margin: 0,
        height: 70
      })
    }
  } catch (e) {
    console.error('條碼產生失敗', e)
  }

  // QR code：左邊可以放簡單文字，右邊放較完整字串
  try {
    const leftData = invoiceNo || 'DR-INVOICE'
    const rightData = JSON.stringify({
      no: invoiceNo,
      random: randomNumber,
      amt: amount,
      s: sellerGUI,
      b: buyerGUI
    })

    new window.QRCode($('#qrLeft'), {
      text: leftData,
      width: 140,
      height: 140
    })

    new window.QRCode($('#qrRight'), {
      text: rightData,
      width: 140,
      height: 140
    })
  } catch (e) {
    console.error('QR 產生失敗', e)
  }
}
