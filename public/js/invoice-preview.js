import { db } from '/js/firebase.js'
import {
  collection,
  query,
  where,
  getDocs
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'

const $ = (s, r = document) => r.querySelector(s)

window.onload = async () => {
  $('#backBtn')?.addEventListener('click', () => {
    if (window.history.length > 1) window.history.back()
    else window.close()
  })

  $('#printBtn')?.addEventListener('click', () => window.print())

  const toggle = $('#toggleDetail')
  if (toggle) {
    toggle.addEventListener('change', () => {
      const area = $('#detailArea')
      if (!area) return
      area.style.display = toggle.checked && area.innerHTML.trim() ? 'block' : 'none'
    })
  }

  const params = new URLSearchParams(window.location.search)
  const invoiceNumber = params.get('invoiceNumber')
  const companyId = params.get('companyId') || ''

  if (!invoiceNumber) {
    alert('缺少發票號碼')
    return
  }

  try {
    const base = [
      collection(db, 'invoices'),
      where('invoiceNumber', '==', invoiceNumber)
    ]
    if (companyId) {
      base.push(where('companyId', '==', companyId))
    }
    const q = query.apply(null, base)
    const snap = await getDocs(q)
    if (snap.empty) {
      alert('找不到這張發票資料')
      return
    }
    const inv = snap.docs[0].data()
    renderInvoice(inv)
  } catch (err) {
    console.error(err)
    alert('載入發票失敗')
  }
}

function renderInvoice(inv) {
  const invoiceNumber = inv.invoiceNumber || ''
  const randomNumber = inv.randomNumber || '----'
  const amount = inv.amount || 0

  $('#invoiceNumber').textContent = invoiceNumber
  $('#randomNumber').textContent = randomNumber
  $('#totalAmount').textContent = amount.toString()

  // 賣方 / 買方統編：同一行顯示
  const sellerGUI = inv.sellerGUI || '48594728'
  const buyerGUI = (inv.buyerGUI || '').trim()
  const hasBuyer = buyerGUI && buyerGUI !== '00000000'

  const sellerCell = $('#sellerGUI')
  const buyerCell = $('#buyerGUI')

  if (sellerCell) sellerCell.textContent = `賣方 ${sellerGUI}`
  if (buyerCell) buyerCell.textContent = hasBuyer ? `買方 ${buyerGUI}` : '買方 —'

  // 發票期別 & 日期時間
  const baseDate =
    inv.createdAt && typeof inv.createdAt.toDate === 'function'
      ? inv.createdAt.toDate()
      : new Date()

  const rocYear = baseDate.getFullYear() - 1911
  const month = baseDate.getMonth() + 1
  const periodStart = month % 2 === 1 ? month : month - 1
  const periodEnd = periodStart + 1

  $('#periodText').textContent =
    `${rocYear}年${String(periodStart).padStart(2, '0')}-${String(
      periodEnd
    ).padStart(2, '0')}月`

  const dateStr = baseDate.toLocaleString('zh-TW', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  })
  const [dPart, tPart] = dateStr.split(' ')
  $('#datetimeText').textContent = dPart.replace(/\//g, '-') + ' ' + tPart

  // Barcode
  try {
    if (invoiceNumber) {
      JsBarcode('#barcode', invoiceNumber, {
        format: 'CODE128',
        displayValue: false,
        height: 80,
        margin: 0
      })
    }
  } catch (e) {
    console.error('Barcode error', e)
  }

  // QRCodes
  const left = $('#qrLeft')
  const right = $('#qrRight')
  if (left) left.innerHTML = ''
  if (right) right.innerHTML = ''

  if (left) {
    new QRCode(left, {
      text: `INV*${invoiceNumber}*${randomNumber}`,
      width: 100,
      height: 100
    })
  }
  if (right) {
    new QRCode(right, {
      text: String(amount),
      width: 100,
      height: 100
    })
  }

  buildDetail(inv.items || [], amount)
}

function buildDetail(items, amount) {
  const area = $('#detailArea')
  if (!area) return

  if (!items.length) {
    area.innerHTML = ''
    area.style.display = 'none'
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
      </tr>`
    )
    .join('')

  area.innerHTML = `
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

  const toggle = $('#toggleDetail')
  area.style.display =
    toggle && toggle.checked && area.innerHTML.trim() ? 'block' : 'none'
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
