import { db } from '/js/firebase.js'
import {
  collection, query, where, limit, getDocs
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'

const $ = (s) => document.querySelector(s)

window.onload = () => {
  setupButtons()
  loadInvoiceFromQuery()
}

function setupButtons () {
  const backBtn = $('#backBtn')
  const printBtn = $('#printBtn')

  if (backBtn) {
    backBtn.addEventListener('click', () => {
      if (history.length > 1) history.back()
      else window.close()
    })
  }

  if (printBtn) {
    printBtn.addEventListener('click', () => window.print())
  }
}

async function loadInvoiceFromQuery () {
  const params = new URLSearchParams(location.search)
  const invoiceNumber = params.get('invoiceNumber') || ''
  const companyId = params.get('companyId') || ''

  if (!invoiceNumber || !companyId) {
    alert('網址缺少發票參數，無法載入。')
    return
  }

  $('#invoiceNumber').textContent = invoiceNumber

  try {
    const qRef = query(
      collection(db, 'invoices'),
      where('invoiceNumber', '==', invoiceNumber),
      where('companyId', '==', companyId),
      limit(1)
    )
    const snap = await getDocs(qRef)
    if (snap.empty) {
      alert('找不到這張發票的資料。')
      return
    }
    const inv = snap.docs[0].data()
    renderInvoice(inv)
  } catch (err) {
    console.error(err)
    alert('讀取發票資料時發生錯誤。')
  }
}

function renderInvoice (inv) {
  const invNo = inv.invoiceNumber || ''
  const randomNumber = inv.randomNumber || ''
  const amount = inv.amount || 0

  $('#invoiceNumber').textContent = invNo
  $('#randomNumber').textContent = randomNumber || '----'
  $('#totalAmount').textContent = amount

  const sellerGUI = inv.sellerGUI || '48594728'
  const buyerGUI = (inv.buyerGUI || '').trim()

  $('#sellerGUI').textContent = sellerGUI
  $('#buyerGUI').textContent = buyerGUI

  // ==== 日期與期別（避免 NaN）====
  let dt = null

  if (inv.createdAt && typeof inv.createdAt.toDate === 'function') {
    dt = inv.createdAt.toDate()
  }

  if (!dt && typeof inv.invoiceDate === 'string') {
    const m = inv.invoiceDate.match(/^(\\d{4})[\\/-](\\d{1,2})[\\/-](\\d{1,2})$/)
    if (m) {
      const y = Number(m[1])
      const mo = Number(m[2])
      const d = Number(m[3])
      dt = new Date(y, mo - 1, d)
    }
  }

  if (!dt) {
    dt = new Date()
  }

  const y = dt.getFullYear()
  const mo = dt.getMonth() + 1
  const d = dt.getDate()
  const hh = String(dt.getHours()).padStart(2, '0')
  const mm = String(dt.getMinutes()).padStart(2, '0')

  const rocYear = y - 1911
  const periodStart = mo % 2 === 1 ? mo : mo - 1
  const periodEnd = periodStart + 1

  $('#periodText').textContent =
    `${rocYear}年${String(periodStart).padStart(2, '0')}-${String(periodEnd).padStart(2, '0')}月`
  $('#datetimeText').textContent =
    `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')} ${hh}:${mm}`

  // ==== 條碼（使用發票號碼）====
  try {
    JsBarcode('#barcode', invNo || '-', {
      format: 'CODE128',
      displayValue: false,
      height: 60,
      margin: 0
    })
  } catch (err) {
    console.error('Barcode error', err)
  }

  // ==== QR Code（暫時用簡單內容）====
  const leftText = `${invNo}|${randomNumber}|${amount}`
  const rightText = `https://www.einvoice.nat.gov.tw/`

  makeQR('qrLeft', leftText)
  makeQR('qrRight', rightText)
}

function makeQR (id, text) {
  const el = document.getElementById(id)
  if (!el) return
  el.innerHTML = ''
  // eslint-disable-next-line no-undef
  new QRCode(el, {
    text: text || '',
    width: el.clientWidth || 160,
    height: el.clientWidth || 160
  })
}