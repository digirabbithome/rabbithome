
import { db } from '/js/firebase.js'
import {
  collection, query, where, getDocs
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'

const $ = (s, r = document) => r.querySelector(s)

function getQueryParams() {
  const params = new URLSearchParams(window.location.search)
  return {
    invoiceNumber: params.get('invoiceNumber') || '',
    companyId: params.get('companyId') || ''
  }
}

window.onload = async () => {
  $('#backBtn')?.addEventListener('click', () => {
    window.history.length > 1 ? window.history.back() : window.close()
  })
  $('#printBtn')?.addEventListener('click', () => window.print())
  $('#toggleDetail')?.addEventListener('change', (e) => {
    const area = $('#detailArea')
    if (!area) return
    area.classList.toggle('visible', e.target.checked)
  })

  const { invoiceNumber, companyId } = getQueryParams()
  if (!invoiceNumber) {
    alert('缺少發票號碼')
    return
  }

  try {
    const q = companyId
      ? query(collection(db, 'invoices'),
              where('invoiceNumber', '==', invoiceNumber),
              where('companyId', '==', companyId))
      : query(collection(db, 'invoices'),
              where('invoiceNumber', '==', invoiceNumber))

    const snap = await getDocs(q)
    if (snap.empty) {
      alert('找不到這張發票資料')
      return
    }
    const doc = snap.docs[0]
    const data = doc.data()
    renderInvoice(data)
  } catch (err) {
    console.error(err)
    alert('載入發票失敗')
  }
}

function renderInvoice(inv) {
  $('#invoiceNumber').textContent = inv.invoiceNumber || ''
  $('#randomNumber').textContent = inv.randomNumber || '----'
  $('#totalAmount').textContent = (inv.amount || 0).toString()
  
  // === 賣方 / 買方統編列 ===
  const sellerGUI = inv.sellerGUI || '48594728'
  const buyerGUI = (inv.buyerGUI || '').trim()

  const sellerCell = document.getElementById('sellerGUI')
  const buyerCell = document.getElementById('buyerGUI')

  const hasBuyer = buyerGUI && buyerGUI !== '00000000'

  if (sellerCell) {
    sellerCell.textContent = `賣方 ${sellerGUI}`
  }

  if (buyerCell) {
    if (hasBuyer) {
      buyerCell.textContent = `買方 ${buyerGUI}`
      if (buyerCell.parentElement) buyerCell.parentElement.style.display = 'block'
    } else {
      buyerCell.textContent = ''
      if (buyerCell.parentElement) buyerCell.parentElement.style.display = 'none'
    }
  }

// === 發票年月雙月期 ===
  let baseDate
  if (inv.createdAt && typeof inv.createdAt.toDate === 'function') {
    baseDate = inv.createdAt.toDate()
  } else if (inv.invoiceDate) {
    baseDate = new Date(inv.invoiceDate.replace(/\//g, '-') + 'T00:00:00')
  } else {
    baseDate = new Date()
  }

  const tpeString = baseDate.toLocaleString('zh-TW', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })
  const m = baseDate.getMonth() + 1
  const rocYear = baseDate.getFullYear() - 1911
  const periodStart = m % 2 === 1 ? m : m - 1
  const periodEnd = periodStart + 1
  $('#periodText').textContent = `${rocYear}年${periodStart.toString().padStart(2,'0')}-${periodEnd.toString().padStart(2,'0')}月`

  const [datePart, timePart] = tpeString.split(' ')
  const dateFormatted = datePart.replaceAll('/', '-')
  $('#datetimeText').textContent = `${dateFormatted} ${timePart.slice(0,5)}`

  // === 條碼 ===
  if (inv.invoiceNumber) {
    try {
      JsBarcode('#barcode', inv.invoiceNumber, {
        format: 'CODE128',
        displayValue: false,
        margin: 0,
        height: 80
      })
    } catch (e) {
      console.error('Barcode error', e)
    }
  }

  // === QR Codes ===
  const left = $('#qrLeft')
  const right = $('#qrRight')
  if (left) left.innerHTML = ''
  if (right) right.innerHTML = ''

  const qrDataLeft = `INV*${inv.invoiceNumber || ''}*${inv.randomNumber || ''}`
  const qrDataRight = JSON.stringify({
    amt: inv.amount || 0,
    orderId: inv.orderId || '',
    companyId: inv.companyId || ''
  })

  if (left) {
    new QRCode(left, {
      text: qrDataLeft,
      width: 150,
      height: 150
    })
  }
  if (right) {
    new QRCode(right, {
      text: qrDataRight,
      width: 150,
      height: 150
    })
  }

  // === 銷售明細 ===
  const detailArea = $('#detailArea')
  if (detailArea && Array.isArray(inv.items) && inv.items.length) {
    const rows = inv.items.map(it => `
      <tr>
        <td>${it.name || ''}</td>
        <td>${it.price || 0}</td>
        <td>${it.qty || 0}</td>
        <td>${it.amount || (it.price || 0) * (it.qty || 0)}</td>
      </tr>`).join('')

    detailArea.innerHTML = `
      <div>銷售明細</div>
      <table class="detail-table">
        <thead>
          <tr>
            <th>品名</th>
            <th>單價</th>
            <th>數量</th>
            <th>金額</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="4" style="text-align:right;">總計：${inv.amount || 0}</td>
          </tr>
        </tfoot>
      </table>
    `
  }
}
