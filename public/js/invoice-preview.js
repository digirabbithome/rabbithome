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
  
  // --- 根據公司自動切換 LOGO 圖檔 ---
  const logoImg = document.querySelector('.logo-img');
  const companyId = inv.companyId || '';

  if (logoImg) {
    switch (companyId) {
      case 'rabbit':
        logoImg.src = '/img/invoice-rabbit.jpg';
        break;
      case 'neversleep':
        logoImg.src = '/img/invoice-neversleep.jpg';
        break;
      case 'focus':
        logoImg.src = '/img/invoice-focus.jpg';
        break;
      default:
        // 若資料庫沒寫 companyId，就當作數位小兔
        logoImg.src = '/img/invoice-rabbit.jpg';
        break;
    }
  }

const invoiceNo    = inv.invoiceNumber || ''
  const randomNumber = inv.randomNumber || inv.randomNumber === 0 ? String(inv.randomNumber) : (inv.items && inv.items[0] && inv.items[0].randomNumber) || '0000'
  const amount       = Number(inv.amount || 0)
  const buyerGUI     = (inv.buyerGUI || '').trim()
  const sellerGUI    = inv.sellerGUI || '48594728'
  const items        = inv.items || []

  const dateInfo = buildDateTexts(inv)

  $('#invoiceNumber').textContent = invoiceNo
  $('#randomNumber').textContent  = randomNumber
  $('#totalAmount').textContent   = amount
  $('#datetimeText').textContent  = dateInfo.dateTimeText
  $('#periodText').textContent    = dateInfo.periodText
  $('#sellerGUI').textContent     = `賣方 ${sellerGUI}`

  if (buyerGUI && buyerGUI !== '00000000') {
    $('#buyerGUI').textContent = `買方 ${buyerGUI}`
  } else {
    $('#buyerGUI').textContent = '買方 —'
  }

  buildBarcode(invoiceNo, dateInfo.rocYear, dateInfo.periodEnd, randomNumber)
  buildQRCodes({
    invoiceNo,
    randomNumber,
    amount,
    rocDate: dateInfo.rocDate,
    buyerGUI,
    sellerGUI,
    items
  })

  buildDetail(items, amount)
}

// 解析日期：優先從 smilepayRaw.xml 中的 InvoiceDate/InvoiceTime，其次用 createdAt
function buildDateTexts(inv) {
  let y, m, d, hh, mm

  const xml = inv.smilepayRaw && inv.smilepayRaw.xml
  if (xml) {
    const dateMatch = /<InvoiceDate>(.*?)<\/InvoiceDate>/i.exec(xml)
    const timeMatch = /<InvoiceTime>(.*?)<\/InvoiceTime>/i.exec(xml)
    if (dateMatch) {
      const parts = dateMatch[1].split(/[\/-]/).map(v => parseInt(v, 10))
      if (parts.length >= 3) {
        y = parts[0]
        m = parts[1]
        d = parts[2]
      }
    }
    if (timeMatch) {
      const parts = timeMatch[1].split(':').map(v => parseInt(v, 10))
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

  const rocYearNum  = y - 1911
  const periodStart = m % 2 === 1 ? m : m - 1
  const periodEnd   = periodStart + 1

  const periodText =
    rocYearNum +
    '年' +
    String(periodStart).padStart(2, '0') +
    '-' +
    String(periodEnd).padStart(2, '0') +
    '月'

  const dateTimeText =
    `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')} ` +
    `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`

  const rocYearStr = String(rocYearNum).padStart(3, '0')
  const rocDate    = rocYearStr + String(m).padStart(2, '0') + String(d).padStart(2, '0')

  return {
    dateTimeText,
    periodText,
    rocYear: rocYearStr,
    periodEnd: String(periodEnd).padStart(2, '0'),
    rocDate
  }
}

// 一維條碼：ROC 年度(3) + 期別最後一月(2) + 發票字軌號碼(10) + 隨機碼(4)
function buildBarcode(invoiceNo, rocYear, periodEnd, randomNumber) {
  const svg = $('#barcode')
  if (!svg) return

  const y   = String(rocYear || '').padStart(3, '0')
  const p   = String(periodEnd || '').padStart(2, '0')
  const rnd = String(randomNumber || '').padStart(4, '0')

  if (!invoiceNo || invoiceNo.length !== 10) {
    console.warn('invoiceNumber 長度不是 10 碼，條碼資料可能不正確')
  }

  const content = `${y}${p}${invoiceNo}${rnd}`

  try {
    JsBarcode(svg, content, {
      format: 'CODE39',
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

// 兩組 QRCode
function buildQRCodes(payload) {
  const leftEl  = $('#qrLeft')
  const rightEl = $('#qrRight')
  if (!leftEl || !rightEl) return

  leftEl.innerHTML  = ''
  rightEl.innerHTML = ''

  const {
    invoiceNo,
    randomNumber,
    amount,
    rocDate,
    buyerGUI,
    sellerGUI,
    items
  } = payload

  const buyerId  = buyerGUI && buyerGUI !== '00000000' ? buyerGUI : '00000000'
  const sellerId = sellerGUI || '00000000'

  const salesAmount = Number(amount || 0) // 未稅額（暫時等於總額）
  const taxAmount   = 0
  const totalAmount = salesAmount + taxAmount

  const rnd4 = String(randomNumber || '').padStart(4, '0')

  // 左 QR 主要內容：發票字軌號碼(10) + 開立日期(ROC 7 碼) + 隨機碼(4) + 銷售額16進位(8) + 總額16進位(8) + 買方統編(8) + 賣方統編(8)
  const leftPayload =
    invoiceNo +
    rocDate +
    rnd4 +
    toHex8(salesAmount) +
    toHex8(totalAmount) +
    buyerId +
    sellerId

  // 右 QR：前兩碼固定 "**" + 品名:數量:單價:...
  const parts = []
  ;(items || []).forEach(item => {
    const name  = String(item.name || '').replace(/:/g, ' ')
    const qty   = item.qty != null ? item.qty : item.amount || 1
    const price = item.price != null ? item.price : item.amount || 0
    parts.push(name, String(qty), String(price))
  })
  const rightPayload = '**' + parts.join(':')

  new QRCode(leftEl, {
    text: leftPayload,
    width: 110,
    height: 110
  })

  new QRCode(rightEl, {
    text: rightPayload,
    width: 110,
    height: 110
  })
}

function toHex8(n) {
  const v = Math.max(0, Math.round(Number(n) || 0))
  return v.toString(16).toUpperCase().padStart(8, '0')
}

// 銷售明細區塊
function buildDetail(items, amount) {
  const area = $('#detailArea')
  if (!area) return

  if (!items || !items.length) {
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
