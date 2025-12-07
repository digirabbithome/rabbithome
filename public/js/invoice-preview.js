
import { db } from '/js/firebase.js'
import {
  collection,
  query,
  where,
  limit,
  getDocs
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'

const $ = (s) => document.querySelector(s)

window.onload = () => {
  $('#backBtn')?.addEventListener('click', () => {
    if (window.history.length > 1) history.back()
    else window.close()
  })
  $('#printBtn')?.addEventListener('click', () => window.print())

  const toggle = $('#toggleDetail')
  const detailSection = $('#detailSection')
  if (toggle && detailSection) {
    const sync = () => {
      detailSection.style.display = toggle.checked ? 'block' : 'none'
    }
    toggle.addEventListener('change', sync)
    sync()
  }

  loadInvoice()
}

async function loadInvoice() {
  const url = new URL(window.location.href)
  const invoiceNumber = url.searchParams.get('invoiceNumber')
  const companyId = url.searchParams.get('companyId')

  if (!invoiceNumber) {
    alert('網址缺少 invoiceNumber 參數')
    return
  }

  try {
    let qRef = query(
      collection(db, 'invoices'),
      where('invoiceNumber', '==', invoiceNumber),
      limit(1)
    )

    if (companyId) {
      qRef = query(
        collection(db, 'invoices'),
        where('invoiceNumber', '==', invoiceNumber),
        where('companyId', '==', companyId),
        limit(1)
      )
    }

    const snap = await getDocs(qRef)
    if (snap.empty) {
      alert('找不到這張發票資料')
      return
    }
    const inv = { id: snap.docs[0].id, ...snap.docs[0].data() }
    renderInvoice(inv)
  } catch (err) {
    console.error(err)
    alert('載入發票失敗')
  }
}

function renderInvoice(inv) {
  const invoiceNo = inv.invoiceNumber || ''
  const randomNumber = inv.randomNumber || '----'
  const amount = inv.amount || 0
  const buyerGUI = (inv.buyerGUI || '').trim()
  const sellerGUI = inv.sellerGUI || '48594728'
  const items = inv.items || []

  const { dateTimeText, periodText } = buildDateTexts(inv)

  $('#invoiceNumber').textContent = invoiceNo
  $('#randomNumber').textContent = randomNumber
  $('#totalAmount').textContent = amount
  $('#datetimeText').textContent = dateTimeText
  $('#periodText').textContent = periodText
  $('#sellerGUI').textContent = sellerGUI
  $('#buyerGUI').textContent = BuyerDisplay(buyerGUI)

  buildBarcode(invoiceNo)
  buildQRCodes(invoiceNo, randomNumber, amount)
  buildDetailSection(items, amount)
}

function BuyerDisplay(gui) {
  if (!gui || gui === '00000000') return '—'
  return gui
}

function buildDateTexts(inv) {
  let y, m, d, hh, mm

  const xml = inv.smilepayRaw && inv.smilepayRaw.xml
  if (xml) {
    const dateMatch = /<InvoiceDate>(.*?)<\/InvoiceDate>/i.exec(xml)
    const timeMatch = /<InvoiceTime>(.*?)<\/InvoiceTime>/i.exec(xml)
    if (dateMatch) {
      const [yy, mo, dd] = dateMatch[1].split('/').map((v) => parseInt(v, 10))
      y = yy
      m = mo
      d = dd
    }
    if (timeMatch) {
      const parts = timeMatch[1].split(':').map((v) => parseInt(v, 10))
      hh = parts[0] ?? 0
      mm = parts[1] ?? 0
    }
  }

  if (!y || !m || !d) {
    const fallback =
      inv.createdAt && inv.createdAt.toDate ? inv.createdAt.toDate() : new Date()
    y = fallback.getFullYear()
    m = fallback.getMonth() + 1
    d = fallback.getDate()
    hh = fallback.getHours()
    mm = fallback.getMinutes()
  }

  const rocYear = y - 1911
  const periodStart = m % 2 === 1 ? m : m - 1
  const periodEnd = periodStart + 1

  const periodText =
    rocYear +
    '年' +
    String(periodStart).padStart(2, '0') +
    '-' +
    String(periodEnd).padStart(2, '0') +
    '月'

  const dateTimeText =
    y +
    '-' +
    String(m).padStart(2, '0') +
    '-' +
    String(d).padStart(2, '0') +
    ' ' +
    String(hh ?? 0).padStart(2, '0') +
    ':' +
    String(mm ?? 0).padStart(2, '0')

  return { dateTimeText, periodText }
}

function buildBarcode(invoiceNo) {
  const svg = document.getElementById('barcode')
  if (!svg) return

  if (!invoiceNo) {
    svg.innerHTML = ''
    return
  }

  try {
    JsBarcode(svg, invoiceNo, {
      format: 'CODE128',
      displayValue: false,
      lineColor: '#000000',
      width: 2,
      height: 80,
      margin: 0
    })
  } catch (err) {
    console.error('Barcode error', err)
  }
}

function buildQRCodes(invoiceNo, randomNumber, amount) {
  const left = document.getElementById('qrLeft')
  const right = document.getElementById('qrRight')
  if (!left || !right) return

  left.innerHTML = ''
  right.innerHTML = ''

  const payloadLeft = 'INV|' + invoiceNo + '|' + randomNumber
  const payloadRight = 'AMT|' + amount

  new QRCode(left, {
    text: payloadLeft,
    width: 220,
    height: 220
  })

  new QRCode(right, {
    text: payloadRight,
    width: 220,
    height: 220
  })
}

function buildDetailSection(items, amount) {
  const section = document.getElementById('detailSection')
  if (!section) return

  if (!items || !items.length) {
    section.style.display = 'none'
    return
  }

  const rowsHtml = items
    .map(
      (it, idx) => `
      <tr>
        <td>${idx + 1}</td>
        <td>${escapeHtml(it.name || '')}</td>
        <td style="text-align:right;">${it.qty || 0}</td>
        <td style="text-align:right;">${it.amount || 0}</td>
      </tr>
    `
    )
    .join('')

  section.innerHTML = `
    <div class="detail-divider">-------------------- ✂ --------------------</div>
    <div class="detail-title">銷售明細</div>
    <table class="detail-table">
      <thead>
        <tr>
          <th>#</th>
          <th>品名</th>
          <th style="text-align:right;">數量</th>
          <th style="text-align:right;">金額</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>
    <div class="detail-total">總計：${amount} 元</div>
    <div class="detail-foot">臺北市信義區大道路74巷1號</div>
    <div class="detail-foot">TEL：02-27592006</div>
  `
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
